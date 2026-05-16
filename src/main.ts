import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import './styles/global.css';
import './styles/editor-overrides.css';

import { AppCoordinator, renderFatalError } from './app/coordinator';

new AppCoordinator().start().catch(renderFatalError);
