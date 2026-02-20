import type { jsPDF } from 'jspdf';

/**
 * 将 PDF 仅下载到本地，尽量不在浏览器中打开。
 * 使用 application/octet-stream 让浏览器当作附件下载而非内嵌打开；
 * 延迟 revoke 确保下载已触发后再释放 URL。
 */
export function downloadPdfAsFile(pdf: jsPDF, filename: string) {
  const raw = pdf.output('arraybuffer');
  const blob = new Blob([raw], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download.pdf';
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}
