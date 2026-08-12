import { Link } from 'react-router-dom';
import MothMark from '../components/MothMark';

export default function Landing() {
  return (
    <main>
      {/* Hero */}
      <section className="container hero">
        <div className="hero-copy">
          <p className="eyebrow rise">A calm 2D drift</p>
          <h1 className="rise rise-1">
            Carry the light,
            <br /> and the dark will answer.
          </h1>
          <p className="lede rise rise-2">
            You are a small luminous moth, adrift in a nocturnal garden. Gather spores of
            light until your glow brims — then the whole grove blooms open in answer. No
            timers. No losing. Just a quiet place to breathe.
          </p>
          <div className="hero-cta rise rise-3">
            <Link to="/play" className="btn btn-primary btn-lg">
              Begin drifting
            </Link>
            <Link to="/leaderboard" className="btn btn-ghost btn-lg">
              Visit the grove
            </Link>
          </div>
          <p className="hero-controls rise rise-4 muted">
            Arrow keys or WASD to move · one button to glide · playable in five seconds.
          </p>
        </div>
        <div className="hero-art rise rise-2" aria-hidden="true">
          <div className="orb">
            <MothMark size={120} />
          </div>
          <span className="firefly f1" />
          <span className="firefly f2" />
          <span className="firefly f3" />
          <span className="firefly f4" />
        </div>
      </section>

      {/* Three notes */}
      <section className="container">
        <div className="grid-2 notes">
          <article className="card note rise">
            <span className="pill">Unwind</span>
            <h3>A world that breathes</h3>
            <p>
              Five drifting parallax layers, soft fireflies, and a moth animated with real
              personality — idle breathing, a gentle wingbeat, a wide glide pose.
            </p>
          </article>
          <article className="card note rise rise-1">
            <span className="pill pill-rose">The Bloom</span>
            <h3>The garden answers</h3>
            <p>
              Gather enough light and the grove responds — lanterns and flowers open in a
              cascading wave, a chord swells, and for a moment the dark is fully alive.
            </p>
          </article>
          <article className="card note rise rise-2">
            <span className="pill">Yours to keep</span>
            <h3>Drift, then rest</h3>
            <p>
              Save a drift to the grove leaderboard, or just wander. Fall too far and you
              settle softly on the grass — never a harsh reset.
            </p>
          </article>
        </div>
      </section>

      <style>{css}</style>
    </main>
  );
}

const css = `
.hero {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  align-items: center;
  gap: 2rem;
  padding: clamp(2.5rem, 8vw, 6rem) clamp(1.1rem, 4vw, 2.4rem);
}
.hero-cta { display: flex; gap: 0.8rem; flex-wrap: wrap; margin: 1.6rem 0 1rem; }
.hero-controls { font-size: 0.9rem; }
.hero-art {
  position: relative;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
}
.orb {
  width: min(320px, 70%);
  aspect-ratio: 1;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 50% 45%, rgba(245,194,107,0.22), rgba(27,21,51,0.1) 60%, transparent 72%);
  animation: floaty 7s ease-in-out infinite;
  filter: drop-shadow(0 0 40px rgba(245,194,107,0.25));
}
.firefly {
  position: absolute;
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--amber);
  box-shadow: 0 0 12px 3px rgba(245,194,107,0.7);
}
.firefly.f1 { top: 22%; left: 20%; animation: floaty 5s ease-in-out infinite; }
.firefly.f2 { top: 68%; left: 30%; animation: floaty 6.5s ease-in-out infinite 0.4s; }
.firefly.f3 { top: 30%; right: 22%; animation: floaty 5.8s ease-in-out infinite 0.8s; }
.firefly.f4 { top: 74%; right: 28%; animation: floaty 7.2s ease-in-out infinite 0.2s; }
.notes { margin: 1rem 0 3rem; }
.note h3 { margin-top: 0.7rem; }
.note p { margin-bottom: 0; }
@media (max-width: 820px) {
  .hero { grid-template-columns: 1fr; }
  .hero-art { order: -1; max-width: 340px; margin: 0 auto; }
}
`;
