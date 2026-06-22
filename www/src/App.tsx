import { useState } from 'react';

const APP_URL = import.meta.env.VITE_APP_URL ?? 'http://localhost:5173';

type CodeTab = 'ts' | 'rust' | 'curl';

const RPC_DOMAIN = import.meta.env.VITE_RPC_DOMAIN ?? 'rpc-mainnet.dev.kevred.net';
const ENDPOINT_URL = `https://3f8a9b2c1d4e6f7a.${RPC_DOMAIN}`;

export default function App() {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<CodeTab>('ts');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ENDPOINT_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable (insecure context, older browser) — leave state untouched
    }
  };

  return (
    <>
      <nav>
        <div className="nav-inner">
          <div className="logo">
            <img src="/logo_kevred_pixel.svg" className="logo-mark" alt="" />
            kevred
          </div>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href={`${APP_URL}/login`} className="btn">Log in</a>
            <a href={`${APP_URL}/login`} className="btn btn-primary">Get started →</a>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="container hero-inner">
          <div className="pill"><span className="pill-dot"></span> Live on Solana mainnet</div>
          <h1>Stop choosing your RPC.<br /><span className="accent">Use them all.</span></h1>
          <p className="lead">
            Any RPC can rate-limit, throttle or break.<br />
            And you never know which one will hold under load.<br />
            <br />
            Stop betting on a single provider.<br />
            Bring your own keys, we dispatch <strong>every RPC call</strong> across Helius, QuickNode, Triton and more.<br />
            <br />
            Pick <strong>sequential</strong> for reliability or <strong>parallel</strong> for speed.
          </p>
          <div className="hero-cta">
            <a href={`${APP_URL}/login`} className="btn btn-primary">Start free →</a>
          </div>

          <div className="endpoint-card">
            <div className="endpoint-header">
              <span>Your endpoint</span>
              <div className="endpoint-dots"><span></span><span></span><span></span></div>
            </div>
            <div className="endpoint-url">
              <span><span className="url">https://</span><span className="token">3f8a9b2c1d4e6f7a</span><span className="url">{`.${RPC_DOMAIN}`}</span></span>
              <button className="copy-btn" onClick={handleCopy}>
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <section id="how">
        <div className="container">
          <div className="section-label">How it works</div>
          <h2>Plug your keys. Get one endpoint.</h2>
          <p className="section-sub">No infrastructure. No custom code. No retry loops on your side. Paste your provider keys and point your client at one URL.</p>

          <div className="steps">
            <div className="step">
              <div className="step-num">01 / Configure</div>
              <h3>Add your provider keys</h3>
              <p>Paste your Helius, QuickNode or Triton API keys. They're stored securely, never logged, never reused.</p>
            </div>
            <div className="step">
              <div className="step-num">02 / Integrate</div>
              <h3>Swap one URL</h3>
              <p>Swap your RPC URL. That's it.</p>
            </div>
            <div className="step">
              <div className="step-num">03 / Dispatch</div>
              <h3>Pick your mode</h3>
              <p><strong>Sequential</strong> to fail over. <strong>Parallel</strong> to race. We handle the rest and auto-exclude failing providers.</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="section-label">Drop-in</div>
          <h2>Works with any Solana client</h2>
          <p className="section-sub">No SDK. No custom transport. Just an HTTPS POST.</p>

          <div className="code-block">
            <div className="code-tabs">
              <div className={`code-tab${tab === 'ts' ? ' active' : ''}`} onClick={() => setTab('ts')}>TypeScript</div>
              <div className={`code-tab${tab === 'rust' ? ' active' : ''}`} onClick={() => setTab('rust')}>Rust</div>
              <div className={`code-tab${tab === 'curl' ? ' active' : ''}`} onClick={() => setTab('curl')}>cURL</div>
            </div>
            {tab === 'ts' && (
              <pre className="code-body"><span className="cm">{'// Before. Juggling multiple providers, manual failover'}</span>{'\n'}<span className="kw">const</span>{' helius = '}<span className="fn">createSolanaRpc</span>{'('}<span className="str">"https://mainnet.helius-rpc.com/?api-key=..."</span>{');\n'}<span className="kw">const</span>{' quicknode = '}<span className="fn">createSolanaRpc</span>{'('}<span className="str">"https://...quiknode.pro/..."</span>{');\n'}<span className="kw">const</span>{' triton = '}<span className="fn">createSolanaRpc</span>{'('}<span className="str">"https://...rpcpool.com/..."</span>{');\n\n'}<span className="cm">{'// After. One URL, kevred handles dispatch'}</span>{'\n'}<span className="kw">const</span>{' rpc = '}<span className="fn">createSolanaRpc</span>{'('}<span className="str">{`"${ENDPOINT_URL}"`}</span>{');\n\n'}<span className="kw">const</span>{' slot = '}<span className="kw">await</span>{' rpc.'}<span className="fn">getSlot</span>{'().'}<span className="fn">send</span>{'();\n'}<span className="cm">{'// better routing to improve reliability or speed'}</span></pre>
            )}
            {tab === 'rust' && (
              <pre className="code-body"><span className="cm">{'// Before. Juggling multiple providers, manual failover'}</span>{'\n'}<span className="kw">let</span>{' helius = '}<span className="fn">RpcClient::new</span>{'('}<span className="str">"https://mainnet.helius-rpc.com/?api-key=..."</span>{'.to_string());\n'}<span className="kw">let</span>{' quicknode = '}<span className="fn">RpcClient::new</span>{'('}<span className="str">"https://...quiknode.pro/..."</span>{'.to_string());\n'}<span className="kw">let</span>{' triton = '}<span className="fn">RpcClient::new</span>{'('}<span className="str">"https://...rpcpool.com/..."</span>{'.to_string());\n\n'}<span className="cm">{'// After. One URL, kevred handles dispatch'}</span>{'\n'}<span className="kw">let</span>{' rpc = '}<span className="fn">RpcClient::new</span>{'('}<span className="str">{`"${ENDPOINT_URL}"`}</span>{'.to_string());\n\n'}<span className="kw">let</span>{' slot = rpc.'}<span className="fn">get_slot</span>{'().'}<span className="kw">await</span>{'?;\n'}<span className="cm">{'// better routing to improve reliability or speed'}</span></pre>
            )}
            {tab === 'curl' && (
              <pre className="code-body"><span className="cm">{'# Before. Juggling multiple providers, manual failover'}</span>{'\n'}<span className="fn">curl</span>{' '}<span className="str">"https://mainnet.helius-rpc.com/?api-key=..."</span>{' -X POST -d '}<span className="str">{'\'{...}\''}</span>{'\n'}<span className="fn">curl</span>{' '}<span className="str">"https://...quiknode.pro/..."</span>{' -X POST -d '}<span className="str">{'\'{...}\''}</span>{'\n'}<span className="fn">curl</span>{' '}<span className="str">"https://...rpcpool.com/..."</span>{' -X POST -d '}<span className="str">{'\'{...}\''}</span>{'\n\n'}<span className="cm">{'# After. One URL, kevred handles dispatch'}</span>{'\n'}<span className="fn">curl</span>{' '}<span className="str">{`"${ENDPOINT_URL}"`}</span>{' \\\n  -X POST -H '}<span className="str">"Content-Type: application/json"</span>{' \\\n  -d '}<span className="str">{'\'{"jsonrpc":"2.0","id":1,"method":"getSlot"}\''}</span>{'\n'}<span className="cm">{'# better routing to improve reliability or speed'}</span></pre>
            )}
          </div>
        </div>
      </section>

      <section id="features">
        <div className="container">
          <div className="section-label">Built for production</div>
          <h2>Reliability or speed. Without the wiring.</h2>
          <p className="section-sub">Edge-deployed on Cloudflare. Sub-10ms overhead.</p>

          <div className="features">
            <div className="feature">
              <div className="feature-icon">↗</div>
              <h3>Speed</h3>
              <p>Parallel mode races every provider at once and returns the fastest response. No more guessing which RPC is quickest.</p>
            </div>
            <div className="feature">
              <div className="feature-icon">⊘</div>
              <h3>Better reliability</h3>
              <p>Transient network errors fail over to the next provider on the same request. Your client sees a single successful response.</p>
            </div>
            <div className="feature">
              <div className="feature-icon">⚿</div>
              <h3>Bring your own keys</h3>
              <p>Your keys, your quota. Stored securely, scoped to your account. We never resell access.</p>
            </div>
            <div className="feature">
              <div className="feature-icon">⚡︎</div>
              <h3>Edge dispatch</h3>
              <p>Runs on Cloudflare Workers, deployed globally across 300+ edge locations. Less than 8ms added latency compared to calling your provider directly.</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="section-label">Dashboard</div>
          <h2>Every provider, one pane of glass</h2>
          <p className="section-sub">Aggregated metrics, circuit breaker state, and your endpoint, all in one place.</p>

          <div className="dash-preview">
            <div className="dash-bar">
              <div className="endpoint-dots"><span></span><span></span><span></span></div>
              <div className="dash-bar-url">dashboard.kevred.io / providers</div>
            </div>
            <div className="dash-body">
              <div className="dash-stats">
                <div className="stat">
                  <div className="stat-label">Requests · 24h</div>
                  <div className="stat-value">1.42M</div>
                  <div className="stat-delta up">↑ 12.4% vs yesterday</div>
                </div>
                <div className="stat">
                  <div className="stat-label">Error rate</div>
                  <div className="stat-value">0.21%</div>
                  <div className="stat-delta up">↓ 0.08pp</div>
                </div>
                <div className="stat">
                  <div className="stat-label">p50 latency</div>
                  <div className="stat-value">84<span style={{ fontSize: 18, color: 'var(--text-muted)' }}> ms</span></div>
                  <div className="stat-delta up">↓ 6ms</div>
                </div>
              </div>

              <div className="provider-list">
                <div className="provider-row head">
                  <div>Provider</div>
                  <div>Share</div>
                  <div>p50</div>
                  <div>p90</div>
                  <div>p99</div>
                  <div>Errors</div>
                </div>
                <div className="provider-row">
                  <div className="provider-name"><span className="dot"></span> Helius</div>
                  <div className="mono">34.2%</div>
                  <div className="mono">72 ms</div>
                  <div className="mono">145 ms</div>
                  <div className="mono">320 ms</div>
                  <div className="mono">0.14%</div>
                </div>
                <div className="provider-row">
                  <div className="provider-name"><span className="dot"></span> QuickNode</div>
                  <div className="mono">33.5%</div>
                  <div className="mono">91 ms</div>
                  <div className="mono">180 ms</div>
                  <div className="mono">410 ms</div>
                  <div className="mono">0.19%</div>
                </div>
                <div className="provider-row">
                  <div className="provider-name"><span className="dot warn"></span> Triton</div>
                  <div className="mono">22.8%</div>
                  <div className="mono">118 ms</div>
                  <div className="mono">240 ms</div>
                  <div className="mono">580 ms</div>
                  <div className="mono">1.42%</div>
                </div>
                <div className="provider-row">
                  <div className="provider-name"><span className="dot err"></span> Alchemy</div>
                  <div className="mono">9.5%</div>
                  <div className="mono">— ms</div>
                  <div className="mono">— ms</div>
                  <div className="mono">— ms</div>
                  <div className="mono">17.8%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing">
        <div className="container">
          <div className="section-label">Pricing</div>
          <h2>Free, for now.</h2>
          <p className="section-sub">All features unlocked. No limits. Pricing will land soon.</p>
        </div>
      </section>

      <section className="cta-final">
        <div className="container">
          <h2>Stop choosing your RPC.<br />Start using all of them in 60 seconds.</h2>
          <p>Paste your provider keys. Get one URL. Ship.</p>
          <div className="hero-cta">
            <a href={`${APP_URL}/login`} className="btn btn-primary">Get started →</a>
          </div>
        </div>
      </section>

      <footer>
        <div className="container footer-inner">
          <div>© 2026 Kevredlabs · Built in France</div>
          <div className="footer-links">
            <a href="#">Status</a>
            <a href="https://github.com/kevredlabs/kevred" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="#">Privacy</a>
          </div>
        </div>
      </footer>
    </>
  );
}
