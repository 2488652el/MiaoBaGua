import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { MODELS, DeepSeekError } from './deepseek.js';

export class DeepSeekConfig {
  constructor(directory,storage) {
    this.file=path.join(directory,'deepseek-settings.json');this.storage=storage;
    this.value={model:MODELS[0],auto:true,key:''};this.warning='';this.savedKey=false;
    try {
      const saved=JSON.parse(readFileSync(this.file,'utf8'));
      this.value.model=MODELS.includes(saved.model)?saved.model:MODELS[0];this.value.auto=saved.auto!==false;
      if(saved.encryptedKey){this.value.key=storage.decryptString(Buffer.from(saved.encryptedKey,'base64'));this.savedKey=true;}
    }catch(error){if(error.code!=='ENOENT')this.warning='DeepSeek 设置未能恢复，请重新保存密钥。';}
  }
  publicState(){return {model:this.value.model,auto:this.value.auto,configured:!!this.value.key,keyStorage:this.value.key?(this.savedKey?'encrypted':'session'):'none',warning:this.warning};}
  privateState(){return {...this.value};}
  update(input) {
    const next={...this.value};
    if(input.model!==undefined){if(!MODELS.includes(input.model))throw new DeepSeekError('请选择支持的 DeepSeek 模型。');next.model=input.model;}
    if(input.auto!==undefined){if(typeof input.auto!=='boolean')throw new DeepSeekError('自动解读设置无效。');next.auto=input.auto;}
    if(input.clearKey===true)next.key='';
    if(input.apiKey!==undefined && input.apiKey!==''){
      if(typeof input.apiKey!=='string'||!/^[\x21-\x7e]{8,256}$/.test(input.apiKey.trim()))throw new DeepSeekError('API Key 格式不正确，请重新粘贴。');
      next.key=input.apiKey.trim();
    }
    let encryptedKey='';
    try {
      if(next.key && this.storage.isEncryptionAvailable())encryptedKey=this.storage.encryptString(next.key).toString('base64');
      writeFileSync(this.file+'.tmp',JSON.stringify({model:next.model,auto:next.auto,encryptedKey},null,2),'utf8');
      renameSync(this.file+'.tmp',this.file);
    }catch{throw new DeepSeekError('DeepSeek 设置未能保存，请检查本机写入权限。');}
    this.value=next;this.savedKey=!!encryptedKey;this.warning=next.key&&!encryptedKey?'系统加密暂不可用，密钥仅在本次运行中使用。':'';
    return this.publicState();
  }
}
