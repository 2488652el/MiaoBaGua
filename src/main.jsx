import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '@fontsource/noto-serif-sc/700.css';
import '@fontsource/noto-serif-sc/900.css';
import './styles.css';
import './oracle-visual.css';
import './deepseek.css';
import './cat.css';

// The private studio keeps its bundled typeface. Public artwork contains no lettering.
const mount=()=>createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
Promise.all([700,900].map(weight=>document.fonts.load(`${weight} 16px "Noto Serif SC"`,'天地雷火山风水泽MiaoBaGua'))).then(mount, error=>{
  console.error('Bundled font could not load',error);mount();
});
