
// ---------------------------------------------------------
// COPIE E COLE ESTE CÓDIGO DENTRO DA SUA EDGE FUNCTION "smart-endpoint"
// NO PAINEL DO SUPABASE E CLIQUE EM "DEPLOY"
// ---------------------------------------------------------

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Configurações do Azure / Power BI
const AZURE_CONFIG = {
  clientId: "be812a00-410c-466a-accc-06b22e3a8fb1",
  tenantId: "91f13493-6dab-4a48-baed-2336fa7ea4a3",
  clientSecret: "Ba68Q~O2vS87GY_k9K5CTOnWVkrZRoynzJ5kzaMK",
  workspaceId: "ea3fb6c3-dbc7-43ec-83c6-8f7ceadfcc58",
  datasetId: "da80cfb6-6798-46fe-b79e-37653f18c1ae",
  scope: "https://analysis.windows.net/powerbi/api/.default",
  pbiTableName: "REL_FINANCEIRO"
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper para converter valores com segurança
const safeInt = (val: any): number => {
  const n = Number(val);
  return isNaN(n) ? 0 : Math.floor(n); // Garante inteiro
};

const safeFloat = (val: any): number => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

// Helper para encontrar colunas com nomes parecidos (fuzzy match)
const findValue = (row: any, ...candidates: string[]) => {
  // 1. Tenta match exato
  for (const c of candidates) {
    if (row[c] !== undefined) return row[c];
  }
  // 2. Tenta match parcial
  const keys = Object.keys(row);
  for (const c of candidates) {
    // Procura uma chave que contenha a string candidata (ex: 'cheq' e 'dt')
    // Simplificação: procura chave que termine com o candidato ou contenha
    const found = keys.find(k => k.includes(c));
    if (found) return row[found];
  }
  return null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("=== [START] Sync V6: Simple Unique (Filial + Lancto) ===");
    
    // 1. Autenticação Microsoft
    const tokenUrl = `https://login.microsoftonline.com/${AZURE_CONFIG.tenantId}/oauth2/v2.0/token`;
    const tokenBody = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: AZURE_CONFIG.clientId,
      client_secret: AZURE_CONFIG.clientSecret,
      scope: AZURE_CONFIG.scope,
    });

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString()
    });

    if (!tokenRes.ok) throw new Error(`Auth Error: ${await tokenRes.text()}`);
    const { access_token } = await tokenRes.json();
    console.log("1. Auth OK");

    // 2. Query Power BI
    console.log("2. Querying Power BI...");
    const daxQuery = `EVALUATE TOPN(10000, '${AZURE_CONFIG.pbiTableName}')`; 
    
    const queryUrl = `https://api.powerbi.com/v1.0/myorg/groups/${AZURE_CONFIG.workspaceId}/datasets/${AZURE_CONFIG.datasetId}/executeQueries`;
    
    const queryRes = await fetch(queryUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        queries: [{ query: daxQuery }],
        serializerSettings: { includeNulls: true }
      })
    });

    if (!queryRes.ok) throw new Error(`PBI Error: ${await queryRes.text()}`);
    const queryData = await queryRes.json();
    const rows = queryData.results?.[0]?.tables?.[0]?.rows || [];
    console.log(`   > Received ${rows.length} rows.`);

    // 3. Mapeamento
    console.log("3. Mapping & Cleaning...");
    
    const rawRecords = rows.map((row: any, idx: number) => {
       // Limpeza das chaves (remove Tabela[] e espaços)
       const cleanRow: any = {};
       Object.keys(row).forEach(key => {
         let cleanKey = key;
         const match = key.match(/\[(.*?)\]/);
         if (match) cleanKey = match[1];
         cleanKey = cleanKey.trim().toLowerCase().replace(/\s+/g, '_'); // Substitui espaços por _
         cleanRow[cleanKey] = row[key];
       });

       // Debug da 1ª linha para encontrar colunas perdidas
       if (idx === 0) {
         console.log("[DEBUG] Clean Keys Sample:", Object.keys(cleanRow).join(', '));
       }

       // Fuzzy Find para cheq_dt_data se não existir direto
       let cheqDtData = cleanRow['cheq_dt_data'];
       if (cheqDtData === undefined) {
          // Tenta encontrar algo que pareça data de cheque
          const fuzzyKey = Object.keys(cleanRow).find(k => k.includes('cheq') && (k.includes('dt') || k.includes('data')));
          if (fuzzyKey) {
             console.log(`[INFO] Mapped 'cheq_dt_data' from '${fuzzyKey}'`);
             cheqDtData = cleanRow[fuzzyKey];
          }
       }

       const parseDate = (v: any) => {
         if (!v) return null;
         try {
           return new Date(v).toISOString().split('T')[0];
         } catch { return null; }
       };

       return {
          agn_in_codigo: safeInt(cleanRow.agn_in_codigo),
          valor: safeFloat(cleanRow.valor),
          mov_dt_vencto: parseDate(cleanRow.mov_dt_vencto),
          mov_dt_datadocto: parseDate(cleanRow.mov_dt_datadocto),
          mov_ch_natureza: cleanRow.mov_ch_natureza || 'C',
          fpa_st_favorecido: cleanRow.fpa_st_favorecido,
          mov_ch_conciliado: cleanRow.mov_ch_conciliado || 'N',
          fil_in_codigo: safeInt(cleanRow.fil_in_codigo),
          rcb_st_nota: cleanRow.rcb_st_nota,
          cheqbx_re_vrbaixa: safeFloat(cleanRow.cheqbx_re_vrbaixa),
          cheqbx_re_vrjuros: safeFloat(cleanRow.cheqbx_re_vrjuros),
          conta_baixa: safeInt(cleanRow.conta_baixa),
          cpa_in_ap: safeInt(cleanRow.cpa_in_ap),
          cpa_st_documento: cleanRow.cpa_st_documento,
          cpa_st_parcela: cleanRow.cpa_st_parcela,
          fpa_dt_emissao: parseDate(cleanRow.fpa_dt_emissao),
          fpa_in_contador: safeInt(cleanRow.fpa_in_contador),
          fpa_in_numero: safeInt(cleanRow.fpa_in_numero),
          fpa_st_doctointerno: cleanRow.fpa_st_doctointerno,
          fpa_tpd_st_codigo: cleanRow.fpa_tpd_st_codigo,
          mov_in_numlancto: safeInt(cleanRow.mov_in_numlancto),
          mov_re_saldocpacre: safeFloat(cleanRow.mov_re_saldocpacre),
          org_in_codigo: safeInt(cleanRow.org_in_codigo),
          cheq_dt_data: parseDate(cheqDtData), 
       };
    });

    // 3.1 DESDUPLICAÇÃO SIMPLIFICADA (Filial + Lancto)
    console.log("3.1 Deduplicating (Filial + Lancto)...");
    const uniqueMap = new Map();
    rawRecords.forEach((r: any) => {
        // Chave composta simples: Filial + NumLancto
        const uniqueKey = `${r.fil_in_codigo}|${r.mov_in_numlancto}`;
        uniqueMap.set(uniqueKey, r);
    });
    
    const records = Array.from(uniqueMap.values());
    console.log(`   > Raw: ${rawRecords.length} -> Unique: ${records.length}`);

    // 4. Upsert
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    // @ts-ignore
    // USA SERVICE_ROLE_KEY SE DISPONIVEL, SENAO TENTA A ORIGINAL, SENAO A ANON (ULTIMO RECURSO)
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("4. Upserting to Supabase...");
    
    const BATCH_SIZE = 1000;
    let totalUpserted = 0;
    
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        
        const { error: dbError } = await supabase
          .from('rel_financeiro')
          .upsert(batch, { 
            // IMPORTANTE: A Constraint no banco deve ser UNIQUE(fil_in_codigo, mov_in_numlancto)
            onConflict: 'fil_in_codigo,mov_in_numlancto', 
            ignoreDuplicates: false 
          });

        if (dbError) {
            console.error(`   [ERROR] Batch ${i}:`, dbError);
            throw dbError; 
        }
        totalUpserted += batch.length;
    }

    console.log(`=== SUCCESS: ${totalUpserted} rows processed ===`);

    return new Response(
      JSON.stringify({ success: true, count: totalUpserted, message: `Sync Complete: ${totalUpserted} records.` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("=== FATAL ERROR ===", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
