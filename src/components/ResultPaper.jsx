import { useId } from 'react';

// Original vector stationery, shared by the live card and the studio preview.
export default function ResultPaper() {
  const paper=useId();
  return <svg className="result-paper-art" viewBox="0 0 360 420" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id={paper} x1="0" y1="0" x2=".25" y2="1">
        <stop offset="0" stopColor="#fffaf0"/>
        <stop offset=".58" stopColor="#fff3d6"/>
        <stop offset="1" stopColor="#f3dfae"/>
      </linearGradient>
    </defs>
    <path d="M25 17L335 17L354 34L354 401L338 418L24 418L14 407L14 32Z" fill="#cba36a" stroke="#a77845" strokeWidth="1.5"/>
    <path d="M21 13L332 13L351 30L351 395L335 414L20 414L11 404L11 28Z" fill="#ead1a1" stroke="#b8905b"/>
    <path d="M23 7L330 7L347 24L347 390L332 409L19 409L7 397L7 23Z" fill={`url(#${paper})`} stroke="#a44931" strokeWidth="2.2"/>
    <path d="M26 18H323L336 30V386L327 397H26L19 389V30Z" fill="none" stroke="#b79860" strokeWidth=".9"/>
    <path d="M32 52H111M249 52H321M32 361H118M242 361H321" fill="none" stroke="#b79058" strokeWidth=".8"/>
    <g fill="#a84b32">
      <path d="M118 49L121 52L118 55L115 52Z"/>
      <path d="M242 49L245 52L242 55L239 52Z"/>
    </g>
    <g stroke="#a64b34" strokeWidth="1.5" fill="none" strokeLinecap="square">
      <path d="M31 43V31H48M25 39V25H43"/>
      <path d="M317 31H329V47M322 25H335V40"/>
      <path d="M31 374V386H48M25 378V392H43"/>
      <path d="M316 386H329V373M322 392H335V378"/>
    </g>
    <g stroke="#997850" strokeWidth=".65" opacity=".12" fill="none">
      <path d="M41 90L70 88M282 106L311 108M35 213L63 211M293 237L318 239M44 343L73 341M276 378L304 377"/>
      <path d="M36 79V103M320 181V207M38 280V300M320 308V327"/>
    </g>
    <path d="M147 361H163L169 356L180 366L191 356L197 361H213" fill="none" stroke="#4d7a67" strokeWidth="1.4"/>
    <path d="M176 360L180 356L184 360L180 364Z" fill="#a34a31"/>
    <path d="M31 402H324" stroke="#fff9e6" strokeWidth="1.5" opacity=".7"/>
  </svg>;
}
