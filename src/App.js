import { TabPanel } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import SettingsTab from './SettingsTab';
import PositioningTab from './PositioningTab';
import StylesTab from './StylesTab';
import './admin.scss';

const TABS = [
	{ name: 'general', title: __( 'General', 'docly' ) },
	{ name: 'positioning', title: __( 'Positioning', 'docly' ) },
	{ name: 'styles', title: __( 'Styles', 'docly' ) },
];

const TAB_KEY = 'docly-admin-tab';

const getInitialTab = () => {
	try {
		const saved = window.localStorage.getItem( TAB_KEY );
		return TABS.some( ( tab ) => tab.name === saved ) ? saved : 'general';
	} catch ( e ) {
		return 'general';
	}
};

const rememberTab = ( name ) => {
	try {
		window.localStorage.setItem( TAB_KEY, name );
	} catch ( e ) {}
};

export default function App() {
	return (
		<div className="docly-admin">
			<h1>{ __( 'Docly', 'docly' ) }</h1>
			<TabPanel
				className="docly-admin__tabs"
				tabs={ TABS }
				initialTabName={ getInitialTab() }
				onSelect={ rememberTab }
			>
				{ ( tab ) => {
					if ( tab.name === 'positioning' ) {
						return <PositioningTab />;
					}
					if ( tab.name === 'styles' ) {
						return <StylesTab />;
					}
					return <SettingsTab />;
				} }
			</TabPanel>
		</div>
	);
}
