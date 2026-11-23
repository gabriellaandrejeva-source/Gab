import './styles.css';

export const metadata = {
  title: 'Pocket Buddy | London journey planner',
  description: 'Plan a London public transport journey and follow one step at a time.',
};

export default function RootLayout({ children }) {
  return <html lang="en-GB"><body>{children}</body></html>;
}

