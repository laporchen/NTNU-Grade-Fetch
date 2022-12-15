import fetch, { Response } from "node-fetch";

function parseCookie(res: Response) {
  if (!res.headers.raw()["set-cookie"]) {
    throw new Error("Cookie is not in the response.");
  }
  let jsessionCookie = res.headers
    .raw()
    ["set-cookie"][0].split(";")
    .map((el) => el.trim());
  return jsessionCookie[0].split("=")[1];
}

function parseSSID(body: string) {
  let parsed = body
    .split("\n")
    .find((el) => el.includes("sessionId")) as string;
  return parsed.split("'")[5];
}
class NTNULogin {
  headers = {};
  #account: string;
  #password: string;
  #jsessionID: string | undefined = "";
  #ssid: string | undefined = "";
  constructor(account: string, password: string) {
    this.#account = account;
    this.#password = password;
  }

  appendHeader(value: Object) {
    let newHeader = structuredClone(this.headers);
    return Object.assign({}, newHeader, value) as {};
  }

  async login() {
    const params = {
      muid: this.#account,
      mpassword: this.#password,
      forceMobile: "pc",
    };
    const referer = "https://iportal.ntnu.edu.tw/ntnu/index.jsp";
    const res = await fetch("https://iportal.ntnu.edu.tw/login.do", {
      method: "POST",
      body: new URLSearchParams(params),
      headers: this.appendHeader({
        Referer: referer,
      }),
    });
    const loginBody = await res.text();
    if (loginBody.includes("登入失敗")) {
      throw new Error("Login failed");
    }
    const jsession = parseCookie(res);
    if (!jsession) {
      throw new Error("Got no JSession ID");
    }
    this.#jsessionID = jsession;
    return true;
  }

  async ssoLogin() {
    const url = `https://iportal.ntnu.edu.tw/ssoIndex.do?apUrl=https://courseap.itc.ntnu.edu.tw/acadmSL/acadmSL.do&apOu=acadmSL&datetime1=${Date.now()}`;
    //https://iportal.ntnu.edu.tw/ssoIndex.do?apUrl=https://courseap.itc.ntnu.edu.tw/acadmSL/acadmSL.do&apOu=acadmSL&datetime1=1668695766775
    //fetch score
    //https://courseap.itc.ntnu.edu.tw/acadmTranscript/AccseldServlet.do?action=scorelist&_dc=1668696201691
    const res = await fetch(url, {
      method: "POST",
      headers: this.appendHeader({
        Cookie: `JSESSIONID=${this.#jsessionID}`,
      }),
    });
    const body = await res.text();
    if (!body.includes("系統登入中")) {
      throw new Error("Failed to log into sso");
    }
    this.#ssid = parseSSID(body);
    if (this.#ssid) {
      return true;
    }
    throw new Error("No ssid was found");
  }
  async fetchGrade() {
    let url = `https://courseap.itc.ntnu.edu.tw/acadmSL/acadmSL.do`;

    let res = await fetch(url, {
      method: "POST",
      headers: this.appendHeader({
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Cookie: `JSESSIONID=${this.#jsessionID}`,
      }),
      body: new URLSearchParams({
        userid: this.#account,
        sessionId: this.#ssid as string,
      }),
    });
    const jsession = parseCookie(res);
    url = `https://courseap.itc.ntnu.edu.tw/acadmTranscript/AccseldServlet.do?lang=Chn&ssid=${jsession}`;
    const transcript = await fetch(url, { method: "GET" });

    this.#jsessionID = parseCookie(transcript);

    url = `https://courseap.itc.ntnu.edu.tw/acadmTranscript/AccseldServlet.do?action=scorelist&_dc=${Date.now()}`;
    res = await fetch(url, {
      method: "POST",
      headers: this.appendHeader({
        Cookie: `JSESSIONID=${this.#jsessionID}`,
      }),
    });
    const data = await res.json()
	if(data) return data
	throw new Error("Failed to get grade json")	
  }
}

export async function getGrade(account: string, password: string) {
  const NTNU = new NTNULogin(account, password);
  let result = null
  await NTNU.login().then(async (res) => {
    if (res) {
      await NTNU.ssoLogin().then(async (res) => {
        if (res) {
          await NTNU.fetchGrade().then(res => {
			  result = res
		  }).catch((err) => {
			  throw new Error(err)
		  })
        }
      });
    }
  });
  if(result){ 
	  return result
  }
  throw new Error("Error occurs when fetching grade")
}

