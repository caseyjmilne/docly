import { createRoot } from '@wordpress/element';
import App from './App';

const root = document.getElementById( 'docly-admin-root' );

if ( root ) {
	createRoot( root ).render( <App /> );
}
