// FLUXO LAB V5.0.0 — SERVIÇO DE ZIP STREAMING E OPERAÇÕES R2

// ZIP64, CRC32, streaming por chunks, cancelamento e exclusão R2 em lote.

// Implementação original preservada; dependências de aplicação injetadas.



const encoderZipV50 = new TextEncoder();

const CRC32_TABELA_V321 = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function u16leV321(n) { const b=new Uint8Array(2),d=new DataView(b.buffer);d.setUint16(0,Number(n)&0xffff,true);return b; }
function u32leV321(n) { const b=new Uint8Array(4),d=new DataView(b.buffer);d.setUint32(0,Number(n)>>>0,true);return b; }
function u64leV321(n) { let x=BigInt(n); const b=new Uint8Array(8); for(let i=0;i<8;i++){b[i]=Number(x&255n);x>>=8n;} return b; }
function concatBytesV321(partes) { const total=partes.reduce((s,p)=>s+p.length,0),out=new Uint8Array(total);let o=0;for(const p of partes){out.set(p,o);o+=p.length;}return out; }
function dosDataHoraV321(valor) { const d=new Date(valor||Date.now()); const ano=Math.max(1980,d.getFullYear()); const data=((ano-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate(); const hora=(d.getHours()<<11)|(d.getMinutes()<<5)|Math.floor(d.getSeconds()/2); return {data,hora}; }
function crc32AtualizarV321(crc, chunk) { let c=crc>>>0; const a=chunk instanceof Uint8Array?chunk:new Uint8Array(chunk); for(let i=0;i<a.length;i++) c=(CRC32_TABELA_V321[(c^a[i])&255]^(c>>>8))>>>0; return c>>>0; }

function zipLocalHeaderV321(nomeBytes, esperado, dt) {
  const extra=concatBytesV321([u16leV321(1),u16leV321(16),u64leV321(esperado),u64leV321(esperado)]);
  const h=new Uint8Array(30); const d=new DataView(h.buffer);
  d.setUint32(0,0x04034b50,true); d.setUint16(4,45,true); d.setUint16(6,0x0808,true); d.setUint16(8,0,true); d.setUint16(10,dt.hora,true); d.setUint16(12,dt.data,true); d.setUint32(14,0,true); d.setUint32(18,0xffffffff,true); d.setUint32(22,0xffffffff,true); d.setUint16(26,nomeBytes.length,true); d.setUint16(28,extra.length,true);
  return concatBytesV321([h,nomeBytes,extra]);
}
function zipDescriptorV321(crc,tamanho){return concatBytesV321([u32leV321(0x08074b50),u32leV321(crc),u64leV321(tamanho),u64leV321(tamanho)]);}
function zipCentralV321(e){
  const extra=concatBytesV321([u16leV321(1),u16leV321(24),u64leV321(e.tamanho),u64leV321(e.tamanho),u64leV321(e.offset)]);
  const h=new Uint8Array(46),d=new DataView(h.buffer);
  d.setUint32(0,0x02014b50,true); d.setUint16(4,45,true); d.setUint16(6,45,true); d.setUint16(8,0x0808,true); d.setUint16(10,0,true); d.setUint16(12,e.dt.hora,true); d.setUint16(14,e.dt.data,true); d.setUint32(16,e.crc>>>0,true); d.setUint32(20,0xffffffff,true); d.setUint32(24,0xffffffff,true); d.setUint16(28,e.nomeBytes.length,true); d.setUint16(30,extra.length,true); d.setUint16(32,0,true); d.setUint16(34,0,true); d.setUint16(36,0,true); d.setUint32(38,0,true); d.setUint32(42,0xffffffff,true);
  return concatBytesV321([h,e.nomeBytes,extra]);
}
function zipFimV321(qtd,centralInicio,centralTamanho,zip64Inicio){
  const z64=new Uint8Array(56),d=new DataView(z64.buffer); d.setUint32(0,0x06064b50,true); z64.set(u64leV321(44n),4); d.setUint16(12,45,true); d.setUint16(14,45,true); d.setUint32(16,0,true); d.setUint32(20,0,true); z64.set(u64leV321(BigInt(qtd)),24); z64.set(u64leV321(BigInt(qtd)),32); z64.set(u64leV321(centralTamanho),40); z64.set(u64leV321(centralInicio),48);
  const loc=new Uint8Array(20),l=new DataView(loc.buffer); l.setUint32(0,0x07064b50,true); l.setUint32(4,0,true); loc.set(u64leV321(zip64Inicio),8); l.setUint32(16,1,true);
  const end=new Uint8Array(22),e=new DataView(end.buffer); e.setUint32(0,0x06054b50,true); e.setUint16(4,0,true); e.setUint16(6,0,true); e.setUint16(8,0xffff,true); e.setUint16(10,0xffff,true); e.setUint32(12,0xffffffff,true); e.setUint32(16,0xffffffff,true); e.setUint16(20,0,true);
  return concatBytesV321([z64,loc,end]);
}

async function* gerarZipPacoteV344ServiceV50(env, pacote, arquivos, estado, deps) {
  let offset=0n; const centrais=[];
  for (const a of arquivos) {
    if (estado.cancelado) return;
    const obj=await env.STL_BUCKET.get(a.chave_r2);
    if(!obj) throw new Error(`Arquivo ausente no R2: ${a.nome_original}`);
    const caminho=deps.caminhoRelativoSeguroV321(a.caminho_relativo,a.nome_original);
    const nomeBytes=encoderZipV50.encode(caminho), dt=dosDataHoraV321(a.enviado_em), localOffset=offset;
    const header=zipLocalHeaderV321(nomeBytes,BigInt(a.tamanho_bytes||0),dt); yield header; offset+=BigInt(header.length);
    let crc=0xffffffff,tamanho=0n; const reader=obj.body.getReader();
    try {
      while(true){
        if(estado.cancelado){try{await reader.cancel();}catch(_){ } return;}
        const {done,value}=await reader.read(); if(done) break;
        const chunk=value instanceof Uint8Array?value:new Uint8Array(value);
        crc=crc32AtualizarV321(crc,chunk); tamanho+=BigInt(chunk.byteLength); offset+=BigInt(chunk.byteLength); yield chunk;
      }
    } finally { try{reader.releaseLock();}catch(_){ } }
    crc=(crc^0xffffffff)>>>0; const desc=zipDescriptorV321(crc,tamanho); yield desc; offset+=BigInt(desc.length);
    centrais.push({nomeBytes,crc,tamanho,offset:localOffset,dt});
  }
  const centralInicio=offset;
  for(const e of centrais){const c=zipCentralV321(e);yield c;offset+=BigInt(c.length);}
  const centralTamanho=offset-centralInicio,zip64Inicio=offset;yield zipFimV321(centrais.length,centralInicio,centralTamanho,zip64Inicio);
}

export function respostaZipPacoteV321ServiceV50(env, usuario, pacote, arquivos, deps) {
  const estado={cancelado:false};
  const iterador=gerarZipPacoteV344ServiceV50(env,pacote,arquivos,estado,deps);
  const stream=new ReadableStream({
    async pull(controller){
      try{
        const {value,done}=await iterador.next();
        if(done){
          try{await deps.registrarEventoPacoteV321(env,pacote.id,usuario.id,'DOWNLOAD_COMPLETO',arquivos.length,arquivos.reduce((s,a)=>s+Number(a.tamanho_bytes||0),0),'ZIP completo gerado pelo servidor. O recebimento ainda precisa ser confirmado pelo destino.');}catch(_){ }
          controller.close(); return;
        }
        controller.enqueue(value);
      }catch(err){controller.error(err);}
    },
    async cancel(){estado.cancelado=true;try{await iterador.return();}catch(_){ }}
  });
  const nome=`${deps.nomePacoteSeguroV321(pacote.nome_pacote)}.zip`;
  const h=new Headers(deps.cabecalhosSegurancaV30("application/zip"));
  h.set("Content-Disposition",`attachment; filename="pacote.zip"; filename*=UTF-8''${encodeURIComponent(nome)}`);
  h.set("Cache-Control","no-store");
  return new Response(stream,{headers:h});
}

export async function deletarChavesR2ServiceV50(bucket, chaves) {
  const unicas=[...new Set((chaves||[]).filter(Boolean))];
  for(let i=0;i<unicas.length;i+=1000) await bucket.delete(unicas.slice(i,i+1000));
}

