import axios from "axios";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";
import { parseString } from "xml2js";
import { promisify } from "util";

const parseXml = promisify(parseString);

const UF_TO_CUF: Record<string, string> = {
  RO: "11",
  AC: "12",
  AM: "13",
  RR: "14",
  PA: "15",
  AP: "16",
  TO: "17",
  MA: "21",
  PI: "22",
  CE: "23",
  RN: "24",
  PB: "25",
  PE: "26",
  AL: "27",
  SE: "28",
  BA: "29",
  MG: "31",
  ES: "32",
  RJ: "33",
  SP: "35",
  PR: "41",
  SC: "42",
  RS: "43",
  MS: "50",
  MT: "51",
  GO: "52",
  DF: "53",
};

const UF_INUTILIZACAO_URL: Record<string, string> = {
  SP: "https://nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx",
};

type InutilizacaoPayload = {
  uf: string;
  cnpj: string;
  modelo: string;
  serie: string;
  numeroInicial: number;
  numeroFinal: number;
  justificativa: string;
  ano: string;
  tpAmb: "1" | "2";
  certBuffer: Buffer;
  certPassword: string;
};

const padLeft = (value: string | number, length: number) =>
  value.toString().padStart(length, "0");

const buildInutNFeXml = (payload: InutilizacaoPayload) => {
  const cUF = UF_TO_CUF[payload.uf];
  if (!cUF) {
    throw new Error(`UF inválida ou não suportada: ${payload.uf}`);
  }

  const serie = padLeft(payload.serie, 3);
  const nNFIni = padLeft(payload.numeroInicial, 9);
  const nNFFin = padLeft(payload.numeroFinal, 9);
  const ano = payload.ano.slice(-2);
  const id = `ID${cUF}${ano}${payload.cnpj}${payload.modelo}${serie}${nNFIni}${nNFFin}`;

  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?>` +
      `<inutNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
      `<infInut Id="${id}">` +
      `<tpAmb>${payload.tpAmb}</tpAmb>` +
      `<xServ>INUTILIZAR</xServ>` +
      `<cUF>${cUF}</cUF>` +
      `<ano>${ano}</ano>` +
      `<CNPJ>${payload.cnpj}</CNPJ>` +
      `<mod>${payload.modelo}</mod>` +
      `<serie>${serie}</serie>` +
      `<nNFIni>${nNFIni}</nNFIni>` +
      `<nNFFin>${nNFFin}</nNFFin>` +
      `<xJust>${payload.justificativa}</xJust>` +
      `</infInut>` +
      `</inutNFe>`,
    id,
  };
};

const extractCertificate = (pfxBuffer: Buffer, password: string) => {
  const p12Der = forge.util.createBuffer(pfxBuffer.toString("binary"));
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  const shroudedBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] || [];
  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.keyBag })[
      forge.pki.oids.keyBag
    ] || [];

  const keyEntry =
    shroudedBags.find((bag) => bag?.key || bag?.privateKey) ||
    keyBags.find((bag) => bag?.key || bag?.privateKey);

  const certBags =
    p12.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ] || [];
  const certEntry = certBags.find((bag) => bag?.cert);

  const privateKey = keyEntry?.key || keyEntry?.privateKey;
  if (!privateKey || !certEntry?.cert) {
    throw new Error("Certificado A1 inválido ou senha incorreta");
  }

  const privateKeyPem = forge.pki.privateKeyToPem(privateKey);
  const certPem = forge.pki.certificateToPem(certEntry.cert);
  const certBase64 = certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");

  return { privateKeyPem, certBase64 };
};

const signXml = (xml: string, cert: { privateKeyPem: string; certBase64: string }) => {
  const sig = new SignedXml();
  sig.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
  sig.canonicalizationAlgorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
  sig.addReference({
    xpath: "//*[local-name()='infInut']",
    transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature"],
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
  });
  sig.signingKey = cert.privateKeyPem;
  sig.keyInfoProvider = {
    getKeyInfo: () =>
      `<X509Data><X509Certificate>${cert.certBase64}</X509Certificate></X509Data>`,
  };
  sig.computeSignature(xml, {
    location: { reference: "//*[local-name()='inutNFe']", action: "append" },
  });
  return sig.getSignedXml();
};

const extractRetInutNFeXml = (responseXml: string) => {
  const match = responseXml.match(/<retInutNFe[\s\S]*<\/retInutNFe>/);
  if (match) {
    return match[0];
  }
  const resultMatch = responseXml.match(/<nfeInutilizacaoNFResult[\s\S]*<\/nfeInutilizacaoNFResult>/);
  if (resultMatch) {
    return resultMatch[0]
      .replace(/<nfeInutilizacaoNFResult>/, "")
      .replace(/<\/nfeInutilizacaoNFResult>/, "");
  }
  throw new Error("Resposta SEFAZ sem retInutNFe");
};

const getRetInutStatus = async (retInutXml: string) => {
  const parsed = await parseXml(retInutXml, {
    explicitArray: true,
    mergeAttrs: true,
    explicitRoot: true,
  });
  const inf = parsed?.retInutNFe?.infInut?.[0];
  const cStat = inf?.cStat?.[0]?.toString();
  const xMotivo = inf?.xMotivo?.[0]?.toString();
  const nProt = inf?.nProt?.[0]?.toString();
  return { cStat, xMotivo, nProt };
};

export async function solicitarInutilizacao(payload: InutilizacaoPayload) {
  const url = UF_INUTILIZACAO_URL[payload.uf];
  if (!url) {
    throw new Error(`UF não suportada para inutilização: ${payload.uf}`);
  }

  const { xml } = buildInutNFeXml(payload);
  const cert = extractCertificate(payload.certBuffer, payload.certPassword);
  const signedXml = signXml(xml, cert);

  const soapEnvelope =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" ` +
    `xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeInutilizacao4">` +
    `<soap12:Body>` +
    `<nfe:nfeInutilizacaoNF>` +
    `<nfe:inutNFe>${signedXml}</nfe:inutNFe>` +
    `</nfe:nfeInutilizacaoNF>` +
    `</soap12:Body>` +
    `</soap12:Envelope>`;

  const response = await axios.post(url, soapEnvelope, {
    headers: {
      "Content-Type": "application/soap+xml; charset=utf-8",
    },
    timeout: 60000,
  });

  const retInutXml = extractRetInutNFeXml(response.data);
  const status = await getRetInutStatus(retInutXml);
  const procInutXml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<ProcInutNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
    `${signedXml}` +
    `${retInutXml}` +
    `</ProcInutNFe>`;

  return {
    signedXml,
    retInutXml,
    procInutXml,
    status,
  };
}
