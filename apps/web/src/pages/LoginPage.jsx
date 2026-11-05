import React, { useEffect, useRef, useState } from "react";
import { Platform, Linking, View } from "react-native-web";
import { request, WEB_URL } from "../services/api.js";
import { Button, Card, Chip, Heading, Page, Field, Txt, useUI, s } from "../components/ui.jsx";
function Google({ accept }) {
    const ref = useRef(null), handler = useRef(accept);
    handler.current = accept;
    const { t } = useUI();
    const [failed, fail] = useState(false);
    const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    useEffect(() => {
        if (!id)
            return;
        const render = () => {
            const g = window.google;
            if (!ref.current || !g)
                return;
            ref.current.replaceChildren();
            g.accounts.id.initialize({
                client_id: id,
                callback: (x) => handler.current(x.credential),
            });
            g.accounts.id.renderButton(ref.current, {
                theme: "outline",
                size: "large",
                width: 260,
            });
        };
        if (window.google) {
            render();
            return;
        }
        let script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
        if (!script) {
            script = document.createElement("script");
            script.src = "https://accounts.google.com/gsi/client";
            script.async = true;
            document.head.append(script);
        }
        const error = () => fail(true);
        script.addEventListener("load", render);
        script.addEventListener("error", error);
        return () => {
            script?.removeEventListener("load", render);
            script?.removeEventListener("error", error);
        };
    }, [id]);
    return !id || failed ? (<Txt muted>
      {t("Google prijava trenutačno nije dostupna.", "Google sign-in unavailable.")}
    </Txt>) : (<View ref={ref}/>);
}
export function Account({ session, change, run, }) {
    const { t, c } = useUI(), [register, setRegister] = useState(false), [name, N] = useState(""), [password, P] = useState(""), [repeat, R] = useState(""), [tried, T] = useState(false), [approved, A] = useState(false);
    const [ticket, K] = useState(null), [pollError, E] = useState("");
    const incoming = Platform.OS === "web"
        ? new URLSearchParams(window.location.hash.slice(1))
        : null;
    useEffect(() => {
        if (!ticket)
            return;
        let active = true, busy = false;
        const until = Date.now() + 300000;
        const timer = setInterval(async () => {
            if (!active || busy)
                return;
            busy = true;
            try {
                if (Date.now() > until)
                    throw Error(t("Prijava je istekla.", "Sign-in expired."));
                const r = await request("/auth/device/take", "POST", { id: ticket.id, pickup: ticket.pickup });
                if (active && r.session) {
                    K(null);
                    await change(r.session);
                }
            }
            catch (e) {
                if (active) {
                    E(String(e));
                    K(null);
                }
            }
            finally {
                busy = false;
            }
        }, 2500);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [ticket]);
    const badName = register
        ? !/^[a-zA-Z0-9_.-]{4,32}$/.test(name.trim())
        : name.trim().length < 4, badPass = password.length < 8 || password.length > 80;
    const submit = () => {
        T(true);
        if (badName || badPass || (register && repeat !== password))
            return;
        void run(async () => change(await request(register ? "/auth/register" : "/auth/login", "POST", {
            username: name.trim(),
            password,
            ...(register ? { repeatPassword: repeat } : {}),
        })));
    };
    return (<Page>
      <Heading title={t("Moj račun", "My account")} subtitle={t("Za pridruživanje grupi nije potrebna registracija.", "You can join a group without signing up.")}/>
      {session ? (<Card>
          <Txt bold>
            {session.user.username || t("Prijavljen/a", "Signed in")}
          </Txt>
          {incoming?.get("id") && incoming.get("approval") && !approved && (<Button label={t("Potvrdi prijavu na mobitelu", "Approve mobile sign-in")} onPress={() => void run(async () => {
                    await request("/auth/device/approve", "POST", {
                        id: incoming.get("id"),
                        approval: incoming.get("approval"),
                    });
                    A(true);
                    window.history.replaceState(null, "", "/login");
                })}/>)}
          {approved && (<Txt>
              {t("Prijava je potvrđena. Vrati se u aplikaciju.", "Approved. Return to the app.")}
            </Txt>)}
          <Button secondary label={t("Odjavi se", "Sign out")} onPress={() => void run(() => change(null))}/>
        </Card>) : (<Card>
          <View style={s.row}>
            <Chip selected={!register} label={t("Prijava", "Sign in")} onPress={() => {
                setRegister(false);
                T(false);
            }}/>
            <Chip selected={register} label={t("Registracija", "Register")} onPress={() => {
                setRegister(true);
                T(false);
            }}/>
          </View>
          <Field label={t("Korisničko ime", "Username")} value={name} onChange={N} maxLength={register ? 32 : 254}/>
          {tried && badName && (<Txt style={{ color: c.danger }}>
              {t("Provjeri korisničko ime.", "Check your username.")}
            </Txt>)}
          <Field label={t("Lozinka", "Password")} secure value={password} onChange={P} maxLength={80}/>
          {tried && badPass && (<Txt style={{ color: c.danger }}>
              {t("Lozinka treba imati 8–80 znakova.", "Use 8–80 characters.")}
            </Txt>)}
          {register && (<Field label={t("Ponovi lozinku", "Repeat password")} secure value={repeat} onChange={R} maxLength={80}/>)}
          {tried && register && repeat !== password && (<Txt style={{ color: c.danger }}>
              {t("Lozinke se ne podudaraju.", "Passwords do not match.")}
            </Txt>)}
          <Button label={register
                ? t("Izradi račun", "Register")
                : t("Prijavi se", "Sign in")} onPress={submit}/>
          {Platform.OS === "web" ? (<Google accept={(credential) => void run(async () => change(await request("/auth/google", "POST", {
                    credential,
                })))}/>) : (<Button secondary disabled={!!ticket} label={t("Nastavi s Googleom", "Continue with Google")} onPress={() => void run(async () => {
                    if (!WEB_URL)
                        throw Error("Postavi EXPO_PUBLIC_WEB_URL.");
                    const x = await request("/auth/device/start", "POST");
                    await Linking.openURL(WEB_URL + "/login#id=" + x.id + "&approval=" + x.approval);
                    E("");
                    K(x);
                })}/>)}
          {ticket && (<>
              <Txt>
                {t("Potvrdi prijavu u pregledniku pa se vrati ovdje.", "Approve sign-in in your browser, then return here.")}
              </Txt>
              <Button secondary label={t("Otkaži", "Cancel")} onPress={() => K(null)}/>
            </>)}
          {!!pollError && <Txt style={{ color: c.danger }}>{pollError}</Txt>}
        </Card>)}
    </Page>);
}
export { Plans } from "./SubscriptionsPage.jsx";
