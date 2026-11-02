import { z } from 'zod';
import { usernameSchema, nameSchema } from './validation';
export const authSchema = z.discriminatedUnion('action',[
 z.object({action:z.literal('login'),username:usernameSchema,password:z.string().min(1).max(128)}),
 z.object({action:z.literal('signup'),username:usernameSchema,displayName:nameSchema,password:z.string().min(8).max(128)}),
 z.object({action:z.literal('recover'),username:usernameSchema,password:z.string().min(8).max(128),recoveryCode:z.string().trim().min(16).max(100)}),
]);
export function usernameAlias(username:string){return `${username}@accounts.nacall.invalid`;}
