
export interface CepData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

export async function lookupCep(cep: string): Promise<CepData | null> {
  // Remove non-numeric characters
  const cleanCep = cep.replace(/\D/g, "");
  
  // Check if CEP has 8 digits
  if (cleanCep.length !== 8) {
    throw new Error("CEP deve ter 8 dígitos");
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    const data: CepData = await response.json();
    
    if (data.erro) {
      throw new Error("CEP não encontrado");
    }

    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Erro ao consultar CEP");
  }
}

// Alternative CEP APIs (in case ViaCEP is down)
export async function lookupCepAlternative(cep: string): Promise<CepData | null> {
  const cleanCep = cep.replace(/\D/g, "");
  
  if (cleanCep.length !== 8) {
    throw new Error("CEP deve ter 8 dígitos");
  }

  // Try different CEP APIs
  const apis = [
    `https://viacep.com.br/ws/${cleanCep}/json/`,
    `https://cdn.apicep.com/file/apicep/${cleanCep}.json`,
    `https://brasilapi.com.br/api/cep/v1/${cleanCep}`
  ];

  for (const apiUrl of apis) {
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      // Normalize response format for different APIs
      if (apiUrl.includes('viacep')) {
        if (data.erro) continue;
        return data;
      } else if (apiUrl.includes('apicep')) {
        return {
          cep: data.code,
          logradouro: data.address,
          complemento: "",
          bairro: data.district,
          localidade: data.city,
          uf: data.state,
          ibge: "",
          gia: "",
          ddd: "",
          siafi: ""
        };
      } else if (apiUrl.includes('brasilapi')) {
        return {
          cep: data.cep,
          logradouro: data.street,
          complemento: "",
          bairro: data.neighborhood,
          localidade: data.city,
          uf: data.state,
          ibge: "",
          gia: "",
          ddd: "",
          siafi: ""
        };
      }
    } catch (error) {
      continue; // Try next API
    }
  }

  throw new Error("Nenhuma API de CEP disponível");
}
