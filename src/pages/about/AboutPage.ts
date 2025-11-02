/**
 * 关于页面 - 原生 TypeScript 实现
 */

export class AboutPage {
  private container: HTMLElement;

  constructor(containerId: string) {
    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`Container with id '${containerId}' not found`);
    }
    this.container = element;
  }

  render(): void {
    this.container.innerHTML = `
      <div class="about-page">
        <div class="about-container">
          <header class="about-header">
            <h1>About This Project</h1>
            <p>A modern TypeScript application with Vite</p>
          </header>

          <main class="about-content">
            <section class="about-section">
              <h2>Technologies Used</h2>
              <div class="tech-grid">
                <div class="tech-card">
                  <h3>TypeScript</h3>
                  <p>For type-safe development</p>
                </div>
                <div class="tech-card">
                  <h3>Vite</h3>
                  <p>Fast build tool and dev server</p>
                </div>
                <div class="tech-card">
                  <h3>TradingView</h3>
                  <p>Advanced charting library</p>
                </div>
              </div>
            </section>

            <section class="about-section">
              <h2>Features</h2>
              <ul class="feature-list">
                <li>🚀 Lightning fast development with Vite</li>
                <li>📝 Full TypeScript support</li>
                <li>📊 TradingView chart integration</li>
                <li>🎨 Modern dark theme UI</li>
                <li>📱 Responsive design</li>
              </ul>
            </section>

            <section class="about-section">
              <h2>Quick Links</h2>
              <div class="links-grid">
                <a href="/" class="link-card">
                  <span>📈</span>
                  <span>TradingView Chart</span>
                </a>
                <a href="https://vite.dev" target="_blank" class="link-card">
                  <span>⚡</span>
                  <span>Vite Documentation</span>
                </a>
                <a href="https://www.typescriptlang.org/" target="_blank" class="link-card">
                  <span>📘</span>
                  <span>TypeScript Handbook</span>
                </a>
              </div>
            </section>
          </main>
        </div>
      </div>
    `;

    // 添加样式
    this.addStyles();
  }

  private addStyles(): void {
    const styleId = 'about-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .about-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
          color: white;
        }

        .about-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .about-header {
          text-align: center;
          margin-bottom: 3rem;
        }

        .about-header h1 {
          font-size: 3rem;
          margin: 0 0 1rem 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .about-header p {
          font-size: 1.2rem;
          color: #cccccc;
          margin: 0;
        }

        .about-section {
          margin-bottom: 3rem;
        }

        .about-section h2 {
          font-size: 2rem;
          margin-bottom: 1.5rem;
          color: #ffffff;
        }

        .tech-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-top: 1.5rem;
        }

        .tech-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
          transition: transform 0.3s ease, background-color 0.3s ease;
        }

        .tech-card:hover {
          transform: translateY(-5px);
          background: rgba(255, 255, 255, 0.08);
        }

        .tech-card h3 {
          margin: 0 0 0.5rem 0;
          color: #667eea;
          font-size: 1.3rem;
        }

        .tech-card p {
          margin: 0;
          color: #cccccc;
        }

        .feature-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .feature-list li {
          padding: 0.8rem 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 1.1rem;
        }

        .feature-list li:last-child {
          border-bottom: none;
        }

        .links-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-top: 1.5rem;
        }

        .link-card {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 1rem;
          text-decoration: none;
          color: white;
          transition: all 0.3s ease;
        }

        .link-card:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: translateY(-2px);
        }

        .link-card span:first-child {
          font-size: 1.5rem;
        }

        /* Responsive design */
        @media (max-width: 768px) {
          .about-container {
            padding: 1rem;
          }

          .about-header h1 {
            font-size: 2rem;
          }

          .about-section h2 {
            font-size: 1.5rem;
          }

          .tech-grid {
            grid-template-columns: 1fr;
          }

          .links-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Body and app overrides for about page */
        body {
          margin: 0;
          background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        }

        #app {
          min-height: 100vh;
          margin: 0;
          padding: 0;
        }
      `;
      document.head.appendChild(style);
    }
  }

  destroy(): void {
    this.container.innerHTML = '';
  }
}