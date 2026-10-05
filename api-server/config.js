export function readConfig(env=process.env) {
  if(env.DATA_SOURCE && env.DATA_SOURCE!=='postgres')throw new Error('A aplicação usa exclusivamente dados reais do PostgreSQL.');
  const database=env.PG_DATABASE || 'dados';
  if(database!=='dados')throw new Error('Configure o banco separado dados.');
  const missing=['PG_HOST','PG_PORT','PG_USER','PG_PASSWORD'].filter(key=>!env[key]);
  if(missing.length)throw new Error(`Configuração PostgreSQL ausente: ${missing.join(', ')}`);
  if(Number(env.PG_PORT)!==5434 || !['localhost','127.0.0.1','::1'].includes(env.PG_HOST))throw new Error('Use a instância local do projeto na porta 5434.');
  const port=Number(env.API_PORT||3002);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Porta HTTP inválida.');
  return {host:'127.0.0.1',port,postgres:{host:env.PG_HOST,port:Number(env.PG_PORT),database,user:env.PG_USER,password:env.PG_PASSWORD,max:4,min:4,idleTimeoutMillis:0,connectionTimeoutMillis:30000,statement_timeout:60000},source:'postgres'};
}
