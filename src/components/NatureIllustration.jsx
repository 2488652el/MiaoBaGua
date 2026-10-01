import { ELEMENTS } from '../broadcast.js';
import { NATURE_PATHS } from '../nature-art.js';

function Motif({index,x,y,size=64,color='#9c432e'}) {
  return <g className="nature-symbol" transform={`translate(${x},${y}) scale(${size/64})`} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {NATURE_PATHS[ELEMENTS[index].id].map((d,i)=><path key={i} d={d} pathLength="1"/>)}
  </g>;
}
export default function NatureIllustration({first=0,second=1,idle=false}) {
  const upper=ELEMENTS[first],lower=ELEMENTS[second];
  return <div className={`nature-illustration ${idle?'is-idle':''}`}>
    <svg viewBox="0 0 320 250" role="img" aria-label={idle?'天地意象，按上下排列':`${upper.name}在上，${lower.name}在下`}>
      <g className="nature-paper">
        <path d="M34 17L283 13L281 113L37 117Z" fill="#cc7745" fillOpacity=".055"/>
        <path d="M38 134L283 129L279 232L35 236Z" fill="#52866d" fillOpacity=".065"/>
        <path d="M27 36V96M293 145V211" stroke="#b79b70" strokeWidth="1" opacity=".5"/>
      </g>
      <path className="nature-divider" d="M45 124H144M176 124H275M155 124L160 119L165 124L160 129Z" fill="none" stroke="#ac7950" strokeWidth=".8" opacity=".5"/>
      <g className="nature-upper" data-nature-position="upper" data-nature={upper.name}>
        <Motif index={first} x={116} y={22} size={88}/>
      </g>
      <g className="nature-lower" data-nature-position="lower" data-nature={lower.name}>
        <Motif index={second} x={116} y={134} size={88} color="#376c5c"/>
      </g>
    </svg>
  </div>;
}
