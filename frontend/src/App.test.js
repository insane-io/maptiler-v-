import { render, screen } from '@testing-library/react';
import App from './App';

describe('App Component', () => {
  test('renders without crashing', () => {
    render(<App />);
  });

  test('contains main content', () => {
    render(<App />);
    const appElement = screen.getByTestId('app') || document.querySelector('.App');
    expect(appElement).toBeInTheDocument();
  });
});