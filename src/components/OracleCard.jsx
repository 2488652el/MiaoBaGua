import { useLayoutEffect, useRef } from 'react';
import RollingDice from './RollingDice.jsx';
import NatureIllustration from './NatureIllustration.jsx';
import ResultPaper from './ResultPaper.jsx';
import { liveIdea } from '../broadcast.js';
import { playCardTransition } from '../card-transition.js';

export default function OracleCard({ result, rolling = false, settled = false, motion }) {
  const idea=liveIdea(result);
  const card=useRef(null);
  useLayoutEffect(()=>{
    if(rolling && motion)return playCardTransition(card.current,motion);
    card.current.dataset.transition=idea?'complete':'idle';
  },[rolling,motion?.id]);
  return <div ref={card} className={'oracle-card inspiration-card '+(rolling?'is-rolling':'')} data-testid="oracle-card" data-card-id={idea?.id??''}>
    <img className="card-frame" src="./assets/card-frame.png" alt="" draggable="false"/>
    <RollingDice values={result} settled={settled} motion={motion} active={rolling}/>
    <div className="card-result" data-testid="card-result">
      <div className="result-ticket" data-testid="result-ticket">
        <ResultPaper/>
        <NatureIllustration first={result?.first} second={result?.second} idle={!idea}/>
      </div>
    </div>
  </div>;
}
