import {Receipt,Car,Utensils,Plane,House,Music,ShoppingBag,HeartPulse} from "lucide-react";
import type {Expense} from "../types";
export type Category=NonNullable<Expense["category"]>;
const icons={other:Receipt,taxi:Car,food:Utensils,travel:Plane,home:House,fun:Music,shopping:ShoppingBag,health:HeartPulse};
export const labels={other:"categoryOther",taxi:"categoryTaxi",food:"categoryFood",travel:"categoryTravel",home:"categoryHome",fun:"categoryFun",shopping:"categoryShopping",health:"categoryHealth"} as const;
const rules:[Category,string[]][]=[['taxi',['taksi','taxi','uber','bolt']],['food',['rucak','vecera','dorucak','pizza','pivo','kava','restoran','hrana','lunch','dinner','coffee']],['travel',['hotel','let','avion','vlak','bus','putovanje','flight','train']],['home',['stanarina','najam','struja','rezije','rent']],['fun',['kino','koncert','cinema','concert']],['shopping',['kupovina','shopping','namirnice']],['health',['ljekarna','lijek','doktor','pharmacy']]];
export function inferCategory(title:string):Category {
 const words=title.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().split(/[^a-z0-9]+/);
 return rules.find(([,keys])=>keys.some(k=>words.includes(k)))?.[0]??"other";
}
export function CategoryIcon({category}:{category:Category}){const Icon=icons[category]||Receipt;return <Icon size={21} aria-hidden="true"/>}
