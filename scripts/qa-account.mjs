import {createClient} from '@supabase/supabase-js';
// Contas de QA dos scripts: criadas pela API administrativa já confirmadas, porque o cadastro público
// exige um código enviado por email. O username entra nos metadados e o trigger cria o perfil.
export async function createQaAccount(admin,url,pub,{username,displayName,password}){
 const email=`${username}@qa.nacall.test`;
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username,display_name:displayName}});
 if(created.error)throw created.error;
 const client=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const signed=await client.auth.signInWithPassword({email,password});
 if(signed.error)throw signed.error;
 return {id:created.data.user.id,email,username,password,session:signed.data.session,client};
}
