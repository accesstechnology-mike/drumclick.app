import type { AppProps } from 'next/app';
import SEOHead from '../components/SEOHead';
import Layout from '../components/Layout';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <SEOHead />
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </>
  );
}