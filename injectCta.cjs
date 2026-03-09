const fs = require('fs');
const path = require('path');

const dir = 'e:\\Exo\\Distrax';
const htmlPath = path.join(dir, 'index.html');
const cssPath = path.join(dir, 'css', 'components.css');

// Modifying HTML
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

const htmlInjection = `
            <!-- CTA Créer une envie -->
            <div class="results-cta" id="resultsCta">
                <div class="cta-content">
                    <div class="cta-icon"><i class="material-icons-round">campaign</i></div>
                    <div class="cta-text">
                        <h3>Vous ne trouvez pas votre bonheur ?</h3>
                        <p>Proposez votre propre activité !</p>
                    </div>
                </div>
                <button class="create-desire-btn" id="resultsCreateBtn">
                    <i class="material-icons-round">add</i><span>Créer une envie</span>
                </button>
            </div>
`;

if (!htmlContent.includes('id="resultsCta"')) {
    htmlContent = htmlContent.replace(/<div class="cards-wrapper" id="cardsWrapper">/, htmlInjection + '\n            <div class="cards-wrapper" id="cardsWrapper">');
    fs.writeFileSync(htmlPath, htmlContent);
    console.log('HTML updated.');
} else {
    console.log('HTML already updated.');
}

// Modifying CSS
let cssContent = fs.readFileSync(cssPath, 'utf8');

const cssInjection = `

        /* --- CTA RESULTATS --- */
        .results-cta {
            background: linear-gradient(135deg, rgba(14, 165, 233, 0.05), rgba(56, 189, 248, 0.1));
            border: 1px dashed rgba(14, 165, 233, 0.3);
            border-radius: 20px;
            padding: 20px;
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            animation: fadeInDown 0.5s ease forwards;
        }

        .cta-content {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .cta-icon {
            width: 48px;
            height: 48px;
            background: white;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--primary);
            box-shadow: 0 4px 10px rgba(14, 165, 233, 0.1);
        }

        .cta-icon i {
            font-size: 24px;
        }

        .cta-text h3 {
            font-size: 15px;
            font-weight: 700;
            color: var(--text-main);
            margin-bottom: 4px;
        }

        .cta-text p {
            font-size: 13.5px;
            color: var(--text-muted);
            line-height: 1.4;
        }

        @media (max-width: 600px) {
            .results-cta {
                flex-direction: column;
                align-items: flex-start;
                padding: 16px;
                gap: 16px;
            }
            .results-cta .create-desire-btn {
                width: 100%;
                justify-content: center;
            }
        }
`;

if (!cssContent.includes('.results-cta {')) {
    cssContent = cssContent.replace('.skeletons-wrapper {', cssInjection + '\n        .skeletons-wrapper {');
    fs.writeFileSync(cssPath, cssContent);
    console.log('CSS updated.');
} else {
    console.log('CSS already updated.');
}
