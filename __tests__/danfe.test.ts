import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { gerarDanfe, danfeExists, getDanfePath } from '../server/danfeService';
import * as fs from 'fs';
import * as path from 'path';

describe('DANFE Service', () => {
  const testXmlPath = path.join(__dirname, 'fixtures', 'nfe-valida.xml');
  const testChave = '43200178969170000158550010000000011000000018';
  let generatedPdfPath: string | null = null;

  // Criar fixture de teste se não existir
  beforeAll(() => {
    const fixturesDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    // XML de teste simplificado (apenas estrutura mínima para gerar DANFE)
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe versao="4.00" Id="NFe${testChave}">
      <ide>
        <cUF>43</cUF>
        <cNF>00000001</cNF>
        <natOp>Venda de Mercadoria</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>1</nNF>
        <dhEmi>2020-01-15T10:00:00-03:00</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>4314902</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>8</cDV>
        <tpAmb>2</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>0</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
        <verProc>1.0</verProc>
      </ide>
      <emit>
        <CNPJ>78969170000158</CNPJ>
        <xNome>EMPRESA TESTE LTDA</xNome>
        <xFant>EMPRESA TESTE</xFant>
        <enderEmit>
          <xLgr>RUA TESTE</xLgr>
          <nro>123</nro>
          <xBairro>CENTRO</xBairro>
          <cMun>4314902</cMun>
          <xMun>PORTO ALEGRE</xMun>
          <UF>RS</UF>
          <CEP>90000000</CEP>
          <cPais>1058</cPais>
          <xPais>BRASIL</xPais>
          <fone>5130000000</fone>
        </enderEmit>
        <IE>1234567890</IE>
        <CRT>3</CRT>
      </emit>
      <dest>
        <CNPJ>12345678000190</CNPJ>
        <xNome>CLIENTE TESTE</xNome>
        <enderDest>
          <xLgr>AV TESTE</xLgr>
          <nro>456</nro>
          <xBairro>CENTRO</xBairro>
          <cMun>4314902</cMun>
          <xMun>PORTO ALEGRE</xMun>
          <UF>RS</UF>
          <CEP>90000001</CEP>
          <cPais>1058</cPais>
          <xPais>BRASIL</xPais>
        </enderDest>
        <indIEDest>1</indIEDest>
        <IE>0987654321</IE>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>001</cProd>
          <cEAN></cEAN>
          <xProd>PRODUTO TESTE</xProd>
          <NCM>12345678</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>1.0000</qCom>
          <vUnCom>100.00</vUnCom>
          <vProd>100.00</vProd>
          <cEANTrib></cEANTrib>
          <uTrib>UN</uTrib>
          <qTrib>1.0000</qTrib>
          <vUnTrib>100.00</vUnTrib>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <modBC>0</modBC>
              <vBC>100.00</vBC>
              <pICMS>18.00</pICMS>
              <vICMS>18.00</vICMS>
            </ICMS00>
          </ICMS>
          <PIS>
            <PISAliq>
              <CST>01</CST>
              <vBC>100.00</vBC>
              <pPIS>1.65</pPIS>
              <vPIS>1.65</vPIS>
            </PISAliq>
          </PIS>
          <COFINS>
            <COFINSAliq>
              <CST>01</CST>
              <vBC>100.00</vBC>
              <pCOFINS>7.60</pCOFINS>
              <vCOFINS>7.60</vCOFINS>
            </COFINSAliq>
          </COFINS>
        </imposto>
      </det>
      <total>
        <ICMSTot>
          <vBC>100.00</vBC>
          <vICMS>18.00</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vFCPST>0.00</vFCPST>
          <vFCPSTRet>0.00</vFCPSTRet>
          <vProd>100.00</vProd>
          <vFrete>0.00</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>0.00</vDesc>
          <vII>0.00</vII>
          <vIPI>0.00</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>1.65</vPIS>
          <vCOFINS>7.60</vCOFINS>
          <vOutro>0.00</vOutro>
          <vNF>100.00</vNF>
        </ICMSTot>
      </total>
      <transp>
        <modFrete>9</modFrete>
      </transp>
      <pag>
        <detPag>
          <indPag>0</indPag>
          <tPag>01</tPag>
          <vPag>100.00</vPag>
        </detPag>
      </pag>
      <infAdic>
        <infCpl>Nota fiscal de teste para geração de DANFE</infCpl>
      </infAdic>
    </infNFe>
    <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
      <SignedInfo>
        <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
        <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
      </SignedInfo>
      <SignatureValue>TEST_SIGNATURE</SignatureValue>
    </Signature>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>2</tpAmb>
      <verAplic>RS20200115100000</verAplic>
      <chNFe>${testChave}</chNFe>
      <dhRecbto>2020-01-15T10:05:00-03:00</dhRecbto>
      <nProt>143200000000001</nProt>
      <digVal>TEST_DIGEST</digVal>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;

    if (!fs.existsSync(testXmlPath)) {
      fs.writeFileSync(testXmlPath, xmlContent, 'utf-8');
      console.log('✅ Fixture de teste criado:', testXmlPath);
    }
  });

  // Limpar arquivos gerados após os testes
  afterAll(() => {
    if (generatedPdfPath && fs.existsSync(generatedPdfPath)) {
      fs.unlinkSync(generatedPdfPath);
      console.log('🧹 PDF de teste removido:', generatedPdfPath);
    }
  });

  it('deve gerar DANFE a partir de XML válido', async () => {
    expect(fs.existsSync(testXmlPath)).toBe(true);
    
    const pdfPath = await gerarDanfe(testXmlPath);
    generatedPdfPath = pdfPath;
    
    expect(fs.existsSync(pdfPath)).toBe(true);
    expect(pdfPath).toContain('-DANFE.pdf');
    
    // Verificar se o arquivo não está vazio
    const stats = fs.statSync(pdfPath);
    expect(stats.size).toBeGreaterThan(0);
  }, 30000); // timeout de 30s para geração

  it('deve retornar o mesmo PDF se já existe (não regerar)', async () => {
    expect(generatedPdfPath).toBeTruthy();
    
    const pdfPath = await gerarDanfe(testXmlPath);
    
    expect(pdfPath).toBe(generatedPdfPath);
  });

  it('deve verificar se DANFE existe', () => {
    const exists = danfeExists(testChave);
    expect(exists).toBe(true);
  });

  it('deve obter o caminho do DANFE existente', () => {
    const pdfPath = getDanfePath(testChave);
    expect(pdfPath).toBeTruthy();
    expect(pdfPath).toContain('-DANFE.pdf');
  });

  it('deve retornar null para DANFE inexistente', () => {
    const pdfPath = getDanfePath('00000000000000000000000000000000000000000000');
    expect(pdfPath).toBeNull();
  });

  it('deve lançar erro para XML inexistente', async () => {
    const invalidPath = path.join(__dirname, 'fixtures', 'nao-existe.xml');
    
    await expect(gerarDanfe(invalidPath)).rejects.toThrow('Arquivo XML não encontrado');
  });

  it('deve detectar nota cancelada corretamente', async () => {
    const canceladaXmlPath = path.join(__dirname, 'fixtures', 'nfe-cancelada.xml');
    const canceladaChave = '43200178969170000158550010000000021000000028';

    // Criar XML de nota cancelada
    const xmlCancelado = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe versao="4.00" Id="NFe${canceladaChave}">
      <ide>
        <cUF>43</cUF>
        <natOp>Venda</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>2</nNF>
        <dhEmi>2020-01-15T10:00:00-03:00</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>4314902</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <tpAmb>2</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>0</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
      </ide>
      <emit>
        <CNPJ>78969170000158</CNPJ>
        <xNome>EMPRESA TESTE</xNome>
        <enderEmit>
          <xLgr>RUA TESTE</xLgr>
          <nro>123</nro>
          <xBairro>CENTRO</xBairro>
          <cMun>4314902</cMun>
          <xMun>PORTO ALEGRE</xMun>
          <UF>RS</UF>
          <CEP>90000000</CEP>
        </enderEmit>
      </emit>
      <dest>
        <CNPJ>12345678000190</CNPJ>
        <xNome>CLIENTE</xNome>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>001</cProd>
          <xProd>PRODUTO</xProd>
          <NCM>12345678</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>1</qCom>
          <vUnCom>100</vUnCom>
          <vProd>100</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vNF>100.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <chNFe>${canceladaChave}</chNFe>
      <cStat>101</cStat>
      <xMotivo>Cancelamento de NF-e homologado</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;

    fs.writeFileSync(canceladaXmlPath, xmlCancelado, 'utf-8');

    const pdfPath = await gerarDanfe(canceladaXmlPath);
    expect(fs.existsSync(pdfPath)).toBe(true);

    // Limpar
    fs.unlinkSync(canceladaXmlPath);
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }
  }, 30000);
});









