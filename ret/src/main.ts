import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AiProjectcreationComponent } from './app/components/ai-projectcreation/ai-projectcreation.component';

bootstrapApplication(AiProjectcreationComponent, appConfig)
  .catch((err) => console.error(err));
