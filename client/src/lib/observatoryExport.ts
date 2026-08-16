export type ExportMessage = { role: "user" | "assistant" | "system"; content: string };

function escapeMarkdown(value: string) {
  return value.replace(/\r/g, "").trim();
}

export function observatoryMessagesToMarkdown(messages: ExportMessage[], exportedAt = new Date()) {
  const lines = [
    "# 財經小智分析紀錄",
    "",
    `匯出時間：${exportedAt.toISOString()}`,
    "",
    ...messages.flatMap(message => [
      `## ${message.role === "user" ? "提問" : message.role === "system" ? "系統脈絡" : "財經小智分析"}`,
      "",
      escapeMarkdown(message.content),
      "",
    ]),
    "> 本檔內容為投資儀表板當時的資料整理與一般性研究觀察，不構成個人化投資建議。",
    "",
  ];
  return lines.join("\n");
}

export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function openPrintPdfPreview(title: string, markdown: string) {
  const popup = window.open("", "_blank");
  if (!popup) return false;
  const escaped = markdown.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:820px;margin:40px auto;padding:0 24px;line-height:1.7;color:#172033;white-space:pre-wrap}h1{font-size:24px} @media print{body{margin:0;max-width:none}}</style></head><body>${escaped}</body></html>`);
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
}
