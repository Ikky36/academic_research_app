const { spawn } = require('child_process');

const envs = [
  { name: 'NEXT_PUBLIC_SUPABASE_URL', value: 'https://dlwwrwwarmflxknynfvk.supabase.co' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsd3dyd3dhcm1mbHhrbnluZnZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NjUzMTcsImV4cCI6MjA5NTA0MTMxN30.cP2RE3TozEHqfexIHl1mL6v_5f5fu7bsEtNIVJeE1uU' },
  { name: 'SCOPUS_API_KEY', value: '3cb611380776af6e0a1f47b4fb64c7ba' },
  { name: 'GEMINI_API_KEY', value: 'AIzaSyBpkF19RePFOYHrZTCrDYnqPkLX-v8x-tU' },
  { name: 'GROQ_API_KEY', value: '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' }
];

const targets = ['production', 'preview', 'development'];

async function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { shell: true });
    
    proc.stdout.on('data', (data) => {
      process.stdout.write(data);
      // Auto-answer "y" for NEXT_PUBLIC_ warnings
      if (data.toString().includes('NEXT_PUBLIC_') || data.toString().includes('?')) {
        proc.stdin.write('y\n');
      }
    });

    proc.stderr.on('data', (data) => {
      process.stderr.write(data);
      if (data.toString().includes('NEXT_PUBLIC_') || data.toString().includes('?')) {
        proc.stdin.write('y\n');
      }
    });

    proc.on('close', (code) => {
      resolve(code);
    });
  });
}

async function pushAll() {
  for (const env of envs) {
    for (const target of targets) {
      console.log(`\nRemoving ${env.name} from ${target}...`);
      await runCommand('npx', ['vercel', 'env', 'rm', env.name, target, '-y']);
      
      console.log(`\nAdding ${env.name} to ${target}...`);
      await runCommand('npx', ['vercel', 'env', 'add', env.name, target, '--value', env.value]);
    }
  }
  console.log("Finished pushing environment variables cleanly!");
}

pushAll();
