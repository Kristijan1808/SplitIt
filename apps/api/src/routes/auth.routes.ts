import { Router } from "express";
import { authService } from "../services/auth.service.js";
import { joinLimit } from "../services/rate-limit.js";

export const authRouter = Router();

authRouter.post("/register", joinLimit, authService.register);
authRouter.post("/login", joinLimit, authService.login);
authRouter.post("/google", joinLimit, authService.google);
authRouter.get("/me", authService.me);
authRouter.post("/logout", authService.logout);

import {LoginTickets} from '../services/mobile-login.js';
import {getUserFromRequest,createToken,prisma} from '../core.js';
const tickets=new LoginTickets();
authRouter.post('/device/start',joinLimit,(_req,res)=>res.set('Cache-Control','no-store').json(tickets.start()));
authRouter.post('/device/approve',joinLimit,async(req,res)=>{
 const auth=getUserFromRequest(req);if(!auth)return res.status(401).json({error:'Prijavi se prije potvrde.'});
 const user=await prisma.user.findUnique({where:{id:auth.id},select:{id:true,username:true}});if(!user)return res.status(401).json({error:'Račun više ne postoji.'});
 tickets.approve(req.body.id,req.body.approval,user);res.json({ok:true});
});
authRouter.post('/device/take',async(req,res)=>{
 res.set('Cache-Control','no-store');const user=tickets.take(req.body.id,req.body.pickup);
 if(!user)return res.json({pending:true});
 res.json({session:{user,token:createToken(user)}});
});
