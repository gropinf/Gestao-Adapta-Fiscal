import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { useAuthStore } from "./auth";

function getAuthHeader(): Record<string, string> {
  const token = useAuthStore.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...getAuthHeader(),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      headers: getAuthHeader(),
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      // Configurações otimizadas de cache:
      staleTime: 1000 * 60 * 5, // 5 minutos - dados são considerados "frescos" por 5min
      gcTime: 1000 * 60 * 30, // 30 minutos (antigo cacheTime) - cache mantido por 30min após componente desmontar
      refetchOnWindowFocus: true, // Recarrega ao voltar para a janela (útil para dados que mudam)
      refetchOnReconnect: true, // Recarrega ao reconectar internet
      refetchInterval: false, // Desabilitado por padrão - componentes específicos podem habilitar
      retry: 1, // Tenta 1 vez em caso de erro
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Backoff exponencial
    },
    mutations: {
      retry: 0, // Mutations não devem retentar automaticamente
      // Retry logic deve ser implementada no código da mutation
    },
  },
});
