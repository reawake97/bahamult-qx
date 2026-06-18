/*
 * 巴哈姆特動畫瘋 — 原生前貼片廣告處理腳本
 * 綁定：^https?:\/\/ani\.gamer\.com\.tw\/ajax\/videoCastcishu\.php
 *       (script-response-body)
 *
 * 作用：
 *   1. 解析本次播放的 sn（集數）與 s（廣告場次 id）。
 *   2. 主動向 videoCastviewing.php 回報「廣告已看完」，讓伺服器把這次
 *      廣告計數標記為完成，後續 token.php 取得 m3u8 金鑰時不會被廣告卡住。
 *   3. 把 videoCastcishu 回應中的倒數秒數歸零（若回應含可辨識欄位），
 *      讓網頁播放器的「廣告剩餘 N 秒」立即可略過。
 *
 * 安全策略：任何解析失敗都「原樣放行」，絕不破壞正常播放。
 */

const url = $request.url;
const rawBody = $response.body;

// 從請求 URL 取出 sn / s 參數
function qs(name) {
  const m = url.match(new RegExp("[?&]" + name + "=([^&]+)"));
  return m ? decodeURIComponent(m[1]) : null;
}

const sn = qs("sn");
const s = qs("s");

// 1) 主動回報廣告觀看完成（best-effort，不阻塞回應）
if (sn) {
  const viewURL =
    "https://ani.gamer.com.tw/ajax/videoCastviewing.php" +
    "?sn=" + encodeURIComponent(sn) +
    (s ? "&s=" + encodeURIComponent(s) : "") +
    "&ad=2&time=1&firstview=1";
  $task.fetch({
    url: viewURL,
    method: "GET",
    headers: {
      Referer: "https://ani.gamer.com.tw/animeVideo.php?sn=" + (sn || ""),
      "User-Agent": $request.headers["User-Agent"] || $request.headers["user-agent"] || "Mozilla/5.0",
    },
  }).then(() => {}, () => {}); // 成功或失敗都忽略，僅盡力而為
}

// 2) 嘗試把回應中的廣告倒數歸零；無法辨識則原樣放行
let body = rawBody;
try {
  const obj = JSON.parse(rawBody);
  let changed = false;
  // 常見的倒數 / 廣告秒數欄位，存在才改，避免亂改未知結構
  ["time", "countdown", "ad_time", "skip", "ad"].forEach((k) => {
    if (k in obj && typeof obj[k] === "number") {
      obj[k] = 0;
      changed = true;
    }
  });
  if (changed) body = JSON.stringify(obj);
} catch (e) {
  // 非 JSON 或解析失敗：原樣放行
}

$done({ body });
