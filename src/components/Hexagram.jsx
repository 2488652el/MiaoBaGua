export default function Hexagram({ bits, moving, className = '' }) {
  if (!bits) return null;
  // Stable uneven outlines keep the printed look while preserving legibility.
  const stroke = (x, y, width, seed) => {
    const shift = Math.sin(seed * 13) * 1.2;
    return `M ${x + 2} ${y + 1 + shift} Q ${x + width * .38} ${y - 1} ${x + width - 2} ${y + 1 - shift} L ${x + width} ${y + 31} Q ${x + width * .6} ${y + 34} ${x + 1} ${y + 32} Z`;
  };
  return <svg className={className} viewBox="0 0 300 300" role="img" aria-label={`自下而上：${bits.map(bit => bit ? '阳' : '阴').join('、')}`}>
    {bits.map((bit, index) => {
      const y = (5 - index) * 53.4;
      return <g key={index} data-line={index + 1} data-yang={bit} className={moving === index + 1 ? 'moving-line' : ''}>
        {bit ? <path d={stroke(0, y, 300, index)}/> : <><path d={stroke(0, y, 130, index)}/><path d={stroke(170, y, 130, index + 7)}/></>}
      </g>;
    })}
  </svg>;
}
