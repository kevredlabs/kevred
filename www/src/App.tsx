import { useState } from 'react';

type CodeTab = 'ts' | 'rust' | 'curl';

export default function App() {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<CodeTab>('ts');

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
            <a href="#docs">Docs</a>
            <a href="login.html" className="btn btn-primary">Log in</a>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="container hero-inner">
          <div className="pill"><span className="pill-dot"></span> Live on Solana mainnet</div>
          <h1>One endpoint.<br /><span className="accent">Every RPC provider.</span></h1>
          <p className="lead">
            Bring your own keys. We dispatch <strong>every RPC call</strong> across Helius, QuickNode, Triton and more — multiplying your effective rate limit, with automatic provider exclusion when one degrades.
          </p>
          <div className="hero-cta">
            <a href="login.html" className="btn btn-primary">Start free →</a>
            <a href="#docs" className="btn">Read the docs</a>
          </div>

          <div className="endpoint-card">
            <div className="endpoint-header">
              <span>Your endpoint</span>
              <div className="endpoint-dots"><span></span><span></span><span></span></div>
            </div>
            <div className="endpoint-url">
              <span><span className="url">https://rpc.kevred.io/</span><span className="token">3f8a9b2c1d4e6f7a</span></span>
              <button className="copy-btn" onClick={() => setCopied(true)}>
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <section id="how">
        <div className="container">
          <div className="section-label">How it works</div>
          <h2>From three API keys to 3× throughput</h2>
          <p className="section-sub">No infrastructure. No retry loops on your side. Paste your provider keys and point your client at one URL.</p>

          <div className="steps">
            <div className="step">
              <div className="step-num">01 / Configure</div>
              <h3>Add your provider keys</h3>
              <p>Paste your Helius, QuickNode or Triton API keys. They're encrypted in a per-client Durable Object — never logged, never reused.</p>
            </div>
            <div className="step">
              <div className="step-num">02 / Integrate</div>
              <h3>Swap one URL</h3>
              <p>Replace your RPC URL with <span className="mono">rpc.kevred.io/{'{token}'}</span>. Compatible with any Solana client — web3.js, kit, anchor.</p>
            </div>
            <div className="step">
              <div className="step-num">03 / Dispatch</div>
              <h3>Round-robin transparently</h3>
              <p>Every RPC call — notably <span className="mono">sendTransaction</span> — is routed to the next provider. Network errors fail over to the next provider in-flight. Repeatedly failing providers are circuit-broken for 30s and silently excluded.</p>
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
              <pre className="code-body"><span className="cm">{'// Before — single provider, capped at 50 req/s'}</span>{'\n'}<span className="kw">const</span>{' rpc = '}<span className="fn">createSolanaRpc</span>{'('}<span className="str">"https://api.helius.xyz/v1?api-key=..."</span>{');\n\n'}<span className="cm">{'// After — kevred dispatches across all your providers'}</span>{'\n'}<span className="kw">const</span>{' rpc = '}<span className="fn">createSolanaRpc</span>{'('}<span className="str">"https://rpc.kevred.io/3f8a9b2c1d4e6f7a"</span>{');\n\n'}<span className="kw">const</span>{' sig = '}<span className="kw">await</span>{' rpc.'}<span className="fn">sendTransaction</span>{'(tx).'}<span className="fn">send</span>{'();\n'}<span className="cm">{'// ↑ routes to Helius, then QuickNode, then Triton, then loops'}</span></pre>
            )}
            {tab === 'rust' && (
              <pre className="code-body"><span className="cm">{'// Before — single provider, capped at 50 req/s'}</span>{'\n'}<span className="kw">let</span>{' rpc = '}<span className="fn">RpcClient::new</span>{'('}<span className="str">"https://api.helius.xyz/v1?api-key=..."</span>{'.to_string());\n\n'}<span className="cm">{'// After — kevred dispatches across all your providers'}</span>{'\n'}<span className="kw">let</span>{' rpc = '}<span className="fn">RpcClient::new</span>{'('}<span className="str">"https://rpc.kevred.io/3f8a9b2c1d4e6f7a"</span>{'.to_string());\n\n'}<span className="kw">let</span>{' sig = rpc.'}<span className="fn">send_transaction</span>{'(&tx).'}<span className="kw">await</span>{'?;\n'}<span className="cm">{'// ↑ routes to Helius, then QuickNode, then Triton, then loops'}</span></pre>
            )}
            {tab === 'curl' && (
              <pre className="code-body"><span className="cm">{'# Before — single provider, capped at 50 req/s'}</span>{'\n'}<span className="fn">curl</span>{' '}<span className="str">"https://api.helius.xyz/v1?api-key=..."</span>{' \\\n  -X POST -H '}<span className="str">"Content-Type: application/json"</span>{' \\\n  -d '}<span className="str">{'\'{"jsonrpc":"2.0","id":1,"method":"sendTransaction","params":[...]}\''}</span>{'\n\n'}<span className="cm">{'# After — kevred dispatches across all your providers'}</span>{'\n'}<span className="fn">curl</span>{' '}<span className="str">"https://rpc.kevred.io/3f8a9b2c1d4e6f7a"</span>{' \\\n  -X POST -H '}<span className="str">"Content-Type: application/json"</span>{' \\\n  -d '}<span className="str">{'\'{"jsonrpc":"2.0","id":1,"method":"sendTransaction","params":[...]}\''}</span>{'\n'}<span className="cm">{'# ↑ routes to Helius, then QuickNode, then Triton, then loops'}</span></pre>
            )}
          </div>
        </div>
      </section>

      <section id="features">
        <div className="container">
          <div className="section-label">Built for production</div>
          <h2>Reliability without the wiring</h2>
          <p className="section-sub">Edge-deployed on Cloudflare. Atomic round-robin via Durable Objects. Sub-10ms overhead.</p>

          <div className="features">
            <div className="feature">
              <div className="feature-icon">↻</div>
              <h3>Atomic round-robin</h3>
              <p>One Durable Object per client guarantees serialized counter access. No two requests ever hit the same provider out of turn.</p>
            </div>
            <div className="feature">
              <div className="feature-icon">⊘</div>
              <h3>Better reliability</h3>
              <p>Transient network errors fail over to the next provider on the same request — your client sees a single successful response. Providers that keep failing are excluded for 30s, then probed and restored as soon as they recover.</p>
            </div>
            <div className="feature">
              <div className="feature-icon">⚿</div>
              <h3>BYOK, encrypted</h3>
              <p>Your keys, your quota. AES-encrypted at rest inside the Durable Object. We never resell access.</p>
            </div>
            <div className="feature">
              <div className="feature-icon">⚡</div>
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
          <p className="section-sub">Aggregated metrics, circuit breaker state, and your endpoint — all in one place.</p>

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
                  <div>Status</div>
                  <div>Share</div>
                  <div>p50 latency</div>
                  <div>Errors</div>
                </div>
                <div className="provider-row">
                  <div className="provider-name"><span className="dot"></span> Helius</div>
                  <div><span className="badge closed">Healthy</span></div>
                  <div className="mono">34.2%</div>
                  <div className="mono">72 ms</div>
                  <div className="mono">0.14%</div>
                </div>
                <div className="provider-row">
                  <div className="provider-name"><span className="dot"></span> QuickNode</div>
                  <div><span className="badge closed">Healthy</span></div>
                  <div className="mono">33.5%</div>
                  <div className="mono">91 ms</div>
                  <div className="mono">0.19%</div>
                </div>
                <div className="provider-row">
                  <div className="provider-name"><span className="dot warn"></span> Triton</div>
                  <div><span className="badge half">Recovering</span></div>
                  <div className="mono">22.8%</div>
                  <div className="mono">118 ms</div>
                  <div className="mono">1.42%</div>
                </div>
                <div className="provider-row">
                  <div className="provider-name"><span className="dot err"></span> Alchemy</div>
                  <div><span className="badge open">Excluded</span></div>
                  <div className="mono">9.5%</div>
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
          <h2>Pay for what you dispatch</h2>
          <p className="section-sub">Your provider quotas stay yours. We charge only for the proxy.</p>

          <div className="pricing">
            <div className="price-card">
              <div className="price-name">Free</div>
              <div className="price-amount">$0<span className="per"> / month</span></div>
              <div className="price-desc">For testing and personal projects.</div>
              <ul className="price-features">
                <li>Up to 2 providers</li>
                <li>100k requests / month</li>
                <li>Circuit breaker (default config)</li>
                <li>Community support</li>
              </ul>
              <a href="login.html" className="btn price-cta">Start free</a>
            </div>

            <div className="price-card featured">
              <div className="price-name">Pro</div>
              <div className="price-amount">$29<span className="per"> / month</span></div>
              <div className="price-desc">For teams shipping on mainnet.</div>
              <ul className="price-features">
                <li>Up to 8 providers</li>
                <li>10M requests / month</li>
                <li>Custom circuit breaker thresholds</li>
                <li>Per-provider metrics & alerts</li>
                <li>Priority support</li>
              </ul>
              <a href="login.html" className="btn btn-primary price-cta">Upgrade to Pro</a>
            </div>

            <div className="price-card">
              <div className="price-name">Scale</div>
              <div className="price-amount">Custom</div>
              <div className="price-desc">High-throughput infra, validator routing.</div>
              <ul className="price-features">
                <li>Unlimited providers</li>
                <li>Volume pricing per million reqs</li>
                <li>Dedicated routing rules</li>
              </ul>
              <a href="#contact" className="btn price-cta">Talk to us</a>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-final">
        <div className="container">
          <h2>Multiply your throughput in 60 seconds.</h2>
          <p>Paste your provider keys. Get one URL. Ship.</p>
          <div className="hero-cta">
            <a href="login.html" className="btn btn-primary">Get started →</a>
            <a href="#docs" className="btn">Read the docs</a>
          </div>
        </div>
      </section>

      <footer>
        <div className="container footer-inner">
          <div>© 2026 Kevredlabs · Built in France</div>
          <div className="footer-links">
            <a href="#">Docs</a>
            <a href="#">Status</a>
            <a href="#">GitHub</a>
            <a href="#">Privacy</a>
          </div>
        </div>
      </footer>
    </>
  );
}
