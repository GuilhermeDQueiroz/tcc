import 'dotenv/config';
import pg from 'pg';
import express from 'express';
import {fileURLToPath} from 'node:url';
import {readConfig} from './config.js';
import {PostgresRepository} from './repositories/postgres.js';
import {LogisticsRepository} from './repositories/logistics.js';
import {SettingsStore} from './settings.js';
import {createApp} from './app.js';
import {warmPool} from './pool.js';
const config=readConfig();const pool=new pg.Pool(config.postgres);
try{await warmPool(pool);}catch(error){console.error('Não foi possível abrir as conexões PostgreSQL do projeto. Confira a configuração e a disponibilidade do banco.');await pool.end();process.exit(1);}
const app=createApp({repository:new PostgresRepository(pool),logisticsRepository:new LogisticsRepository(pool),settingsStore:new SettingsStore()});
const dist=fileURLToPath(new URL('../dist',import.meta.url));
app.use(express.static(dist));app.get('/{*path}',(req,res)=>res.sendFile(dist+'/index.html'));
const server=app.listen(config.port,config.host,error=>{if(error){console.error(`Não foi possível abrir a API local na porta ${config.port}: ${error.code}.`);void pool.end().then(()=>{process.exitCode=1;});return;}console.log(`API e aplicação: http://${config.host}:${config.port} • PostgreSQL dados:5434`);});
async function shutdown(){server.close();await pool.end();process.exit(0);}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
