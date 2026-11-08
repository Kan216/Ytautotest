// Painted canvas textures shared by kits: wall bays with windows, clock face, flag, smoke, bursts, contact blob.
import * as THREE from "three";
import { ctex } from "./paint";
import { Pen, INK, fxBurst } from "./toon";
// ---------------- painted textures ----------------
export const INKL = "rgba(36,23,38,0.9)";
/** one 4 x 4 m wall bay: plaster with soft mottling, an arched window with shutters, sill, floor band */
export const bayTex = (key: string, wall: string, shutter: string, opts: { door?: boolean; arch?: boolean; band?: string } = {}) =>
  ctex("bay" + key, 512, 512, (g, r) => {
    g.fillStyle = wall; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 90; i++) { // plaster mottling
      g.fillStyle = `rgba(${r() < 0.5 ? "120,100,80" : "255,250,240"},${(0.02 + r() * 0.04).toFixed(3)})`;
      g.beginPath(); g.ellipse(r() * 512, r() * 512, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, Math.PI * 2); g.fill();
    }
    if (opts.band) { g.fillStyle = opts.band; g.fillRect(0, 0, 512, 26); g.strokeStyle = INKL; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 26); g.lineTo(512, 26); g.stroke(); }
    const w = opts.door ? 170 : 140, h = opts.door ? 330 : 230, x = 256 - w / 2, y = opts.door ? 512 - h : 150, arch = opts.arch !== false;
    const path = () => {
      g.beginPath(); g.moveTo(x, y + h);
      if (arch) { g.lineTo(x, y + w / 2); g.arc(256, y + w / 2, w / 2, Math.PI, 0); } else { g.lineTo(x, y); g.lineTo(x + w, y); }
      g.lineTo(x + w, y + h); g.closePath();
    };
    path(); g.fillStyle = "#2c3a46"; g.fill();
    if (!opts.door) { // open shutters either side
      for (const s of [-1, 1]) {
        const sx = s < 0 ? x - 62 : x + w + 6;
        g.fillStyle = shutter; g.fillRect(sx, y + 30, 56, h - 30);
        g.strokeStyle = INKL; g.lineWidth = 5; g.strokeRect(sx, y + 30, 56, h - 30);
        g.lineWidth = 2.5; for (let k = 1; k < 7; k++) { g.beginPath(); g.moveTo(sx + 6, y + 30 + k * (h - 30) / 7); g.lineTo(sx + 50, y + 30 + k * (h - 30) / 7); g.stroke(); }
      }
      g.fillStyle = "#e9e1cf"; g.fillRect(x - 12, y + h, w + 24, 16); g.strokeStyle = INKL; g.lineWidth = 4; g.strokeRect(x - 12, y + h, w + 24, 16);
    } else {
      g.fillStyle = "#7a4a2a"; g.fillRect(x + 8, y + w / 2, w - 16, h - w / 2);
      g.strokeStyle = INKL; g.lineWidth = 4; g.beginPath(); g.moveTo(256, y + w / 2); g.lineTo(256, 512); g.stroke();
    }
    path(); g.strokeStyle = INKL; g.lineWidth = 7; g.stroke();
  });
export const clockTex = () => ctex("clockFace", 512, 512, (g) => {
  g.fillStyle = "#c9b48a"; g.beginPath(); g.arc(256, 256, 250, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#f7f2e4"; g.beginPath(); g.arc(256, 256, 214, 0, Math.PI * 2); g.fill();
  g.strokeStyle = INK; g.lineWidth = 16; g.beginPath(); g.arc(256, 256, 216, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 10; g.beginPath(); g.arc(256, 256, 248, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, big = i % 15 === 0, mid = i % 5 === 0, r0 = big ? 160 : mid ? 176 : 192;
    g.lineWidth = big ? 16 : mid ? 9 : 4; g.lineCap = "round";
    g.beginPath(); g.moveTo(256 + Math.sin(a) * r0, 256 - Math.cos(a) * r0); g.lineTo(256 + Math.sin(a) * 200, 256 - Math.cos(a) * 200); g.stroke();
  }
});
export const flagTex = (colr = "#cf2f2c") => ctex("flag" + colr, 256, 160, (g) => {
  g.fillStyle = colr; g.fillRect(0, 0, 256, 160);
  for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(90,0,10,${0.05 + 0.03 * (i % 2)})`; g.fillRect(i * 44, 0, 22, 160); }
});
export const smokeTex = (i: number, dark: boolean) => ctex(`smoke${i}${dark}`, 256, 256, (g, r) => {
  const p = new Pen(g), base = dark ? ["#6f6b74", "#86828c", "#5e5a63"] : ["#f4f2ee", "#e2dfdc", "#d2cfd2"];
  const blobs: [number, number, number][] = [];
  for (let k = 0; k < 7; k++) blobs.push([128 + (r() - 0.5) * 120, 140 + (r() - 0.5) * 90, 34 + r() * 30]);
  for (const [x, y, rr] of blobs) p.ell(x, y + 6, rr, rr * 0.85, base[2], 0);
  for (const [x, y, rr] of blobs) p.ell(x - 4, y, rr * 0.92, rr * 0.8, base[1], 0);
  for (const [x, y, rr] of blobs.slice(0, 4)) p.ell(x - 10, y - 8, rr * 0.6, rr * 0.5, base[0], 0);
});
export const burstTex = (k: number, colr: string) => ctex(`burst${colr}${k}`, 500, 500, (g) => fxBurst(new Pen(g), k / 7, colr, 11, 50, 235));
export const blobTex = () => ctex("contactBlob", 128, 128, (g) => {
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "#5b5f80"); gr.addColorStop(0.45, "#7d80a0"); gr.addColorStop(0.8, "#e6e6f0"); gr.addColorStop(1, "#ffffff");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
