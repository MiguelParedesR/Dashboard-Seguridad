import { RouterProvider } from 'react-router-dom';
import router from './router.jsx';
import '../styles/apple.css';

export default function App() {
  return <RouterProvider router={router} />;
}
