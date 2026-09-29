import './style.css';
import { stages } from './stages';
import { Game } from './game/game';
import { Renderer } from './render/renderer';
import { bindView, createView } from './ui/view';

try {
  const canvas = createView();
  const game = new Game(stages[0], stages);
  const renderer = new Renderer(canvas, game);
  bindView(game, renderer);
  game.render = () => renderer.draw();
  game.onFrameCost = milliseconds => renderer.recordFrameCost(milliseconds);
  game.run();
} catch (error) {
  console.error(error);
  const panel = document.createElement('div');
  panel.className = 'load-error';
  const title = document.createElement('h1');
  title.textContent = '게임을 불러오지 못했어요.';
  const message = document.createElement('p');
  message.textContent = '최신 브라우저에서 페이지를 새로고침해 주세요.';
  const button = document.createElement('button');
  button.textContent = '새로고침';
  button.addEventListener('click', () => location.reload());
  panel.append(title, message, button);
  document.getElementById('app')?.replaceChildren(panel);
}
