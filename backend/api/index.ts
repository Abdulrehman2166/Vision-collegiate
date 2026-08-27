// Vercel serverless entry — imports the Express app. app.listen() is skipped
// because VERCEL env var is set, so the app is exported as the function.
import app from '../src/index';

export default app;