/* CP Manage — floating accounting/tax chat widget.
   Talks to the cpm-chat backend (Ollama gemma3:12b, accounting-scoped).
   Self-contained: no dependencies. Brand = gold #bf9b3e / charcoal. */
(function () {
  // API endpoint — production: https://chat.cp-manage.com ; local test: http://localhost:8593
  var API = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://localhost:8593"
    : "https://chat.cp-manage.com";

  var GOLD = "#bf9b3e", GOLD_D = "#9c7c2a", INK = "#2b2a28";
  var history = [];
  var busy = false;

  var css = `
  #cpm-bubble{position:fixed;right:22px;bottom:22px;width:60px;height:60px;border-radius:50%;
    background:linear-gradient(135deg,${GOLD},${GOLD_D});color:#fff;font-size:1.7rem;border:none;
    cursor:pointer;box-shadow:0 8px 24px rgba(150,115,30,.4);z-index:9998;display:grid;place-items:center;
    transition:transform .15s}
  #cpm-bubble:hover{transform:scale(1.08)}
  #cpm-panel{position:fixed;right:22px;bottom:94px;width:360px;max-width:calc(100vw - 32px);height:520px;
    max-height:calc(100vh - 130px);background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.25);
    z-index:9999;display:none;flex-direction:column;overflow:hidden;font-family:"Prompt",system-ui,sans-serif}
  #cpm-panel.open{display:flex}
  #cpm-head{background:linear-gradient(135deg,${INK},#3a352b);color:#fff;padding:14px 16px;display:flex;
    align-items:center;gap:10px}
  #cpm-head img{width:30px;height:30px;border-radius:6px;background:#fff;padding:3px}
  #cpm-head b{font-size:.95rem;font-weight:600}
  #cpm-head span{font-size:.72rem;color:#cdc6b6;display:block;font-weight:300}
  #cpm-x{margin-left:auto;background:none;border:none;color:#cdc6b6;font-size:1.3rem;cursor:pointer}
  #cpm-msgs{flex:1;overflow-y:auto;padding:16px;background:#faf8f3;font-size:.9rem;line-height:1.6}
  .cpm-m{margin-bottom:12px;display:flex}
  .cpm-m.u{justify-content:flex-end}
  .cpm-b{max-width:80%;padding:10px 13px;border-radius:14px;white-space:pre-wrap;word-break:break-word}
  .cpm-m.u .cpm-b{background:${GOLD};color:#fff;border-bottom-right-radius:4px}
  .cpm-m.a .cpm-b{background:#fff;color:${INK};border:1px solid #ece7dc;border-bottom-left-radius:4px}
  #cpm-foot{display:flex;gap:8px;padding:12px;border-top:1px solid #ece7dc;background:#fff}
  #cpm-in{flex:1;border:1px solid #ddd5c4;border-radius:10px;padding:10px 12px;font-family:inherit;
    font-size:.9rem;outline:none;resize:none;max-height:90px}
  #cpm-in:focus{border-color:${GOLD}}
  #cpm-send{background:${GOLD};color:#fff;border:none;border-radius:10px;width:44px;font-size:1.1rem;
    cursor:pointer;flex-shrink:0}
  #cpm-send:disabled{opacity:.5;cursor:default}
  .cpm-dots span{display:inline-block;width:6px;height:6px;margin:0 1px;border-radius:50%;background:${GOLD};
    animation:cpmb 1s infinite}
  .cpm-dots span:nth-child(2){animation-delay:.2s}.cpm-dots span:nth-child(3){animation-delay:.4s}
  @keyframes cpmb{0%,60%,100%{opacity:.3}30%{opacity:1}}
  `;
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var wrap = document.createElement("div");
  wrap.innerHTML = `
  <button id="cpm-bubble" title="ปรึกษาบัญชี/ภาษี">💬</button>
  <div id="cpm-panel">
    <div id="cpm-head">
      <img src="/assets/logo-symbol.png" alt="">
      <div><b>ผู้ช่วย C P Manage</b><span>ถามเรื่องบัญชี · ภาษี · จดทะเบียน</span></div>
      <button id="cpm-x">×</button>
    </div>
    <div id="cpm-msgs"></div>
    <div id="cpm-foot">
      <textarea id="cpm-in" rows="1" placeholder="พิมพ์คำถาม…"></textarea>
      <button id="cpm-send">➤</button>
    </div>
  </div>`;
  document.body.appendChild(wrap);

  var panel = document.getElementById("cpm-panel");
  var msgs = document.getElementById("cpm-msgs");
  var input = document.getElementById("cpm-in");
  var sendBtn = document.getElementById("cpm-send");

  function add(role, text) {
    var m = document.createElement("div");
    m.className = "cpm-m " + (role === "user" ? "u" : "a");
    m.innerHTML = '<div class="cpm-b"></div>';
    m.querySelector(".cpm-b").textContent = text;
    msgs.appendChild(m); msgs.scrollTop = msgs.scrollHeight;
    return m;
  }
  function typing() {
    var m = document.createElement("div"); m.className = "cpm-m a";
    m.innerHTML = '<div class="cpm-b"><span class="cpm-dots"><span></span><span></span><span></span></span></div>';
    msgs.appendChild(m); msgs.scrollTop = msgs.scrollHeight; return m;
  }

  var greeted = false;
  function open() {
    panel.classList.add("open");
    if (!greeted) { add("assistant", "สวัสดีค่ะ 😊 มีอะไรให้ช่วยเรื่องบัญชี ภาษี หรือการจดทะเบียนบริษัทไหมคะ?"); greeted = true; }
    input.focus();
  }
  document.getElementById("cpm-bubble").onclick = function () {
    panel.classList.contains("open") ? panel.classList.remove("open") : open();
  };
  document.getElementById("cpm-x").onclick = function () { panel.classList.remove("open"); };

  async function send() {
    var text = input.value.trim();
    if (!text || busy) return;
    input.value = ""; input.style.height = "auto";
    add("user", text);
    history.push({ role: "user", content: text });
    busy = true; sendBtn.disabled = true;
    var t = typing();
    try {
      var res = await fetch(API + "/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: history.slice(0, -1) })
      });
      var data = await res.json();
      t.remove();
      var reply = data.reply || "ขออภัยค่ะ ระบบขัดข้อง ลองใหม่อีกครั้งนะคะ";
      add("assistant", reply);
      history.push({ role: "assistant", content: reply });
    } catch (e) {
      t.remove();
      add("assistant", "ขออภัยค่ะ เชื่อมต่อระบบไม่ได้ตอนนี้ กรุณาโทร 094 539 2498 ค่ะ");
    }
    busy = false; sendBtn.disabled = false; input.focus();
  }
  sendBtn.onclick = send;
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  input.addEventListener("input", function () {
    input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 90) + "px";
  });
})();
