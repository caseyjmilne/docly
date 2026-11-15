import { useEffect, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import {
	Button,
	Card,
	CardBody,
	CardHeader,
	Notice,
	SelectControl,
	Spinner,
} from '@wordpress/components';

const OPTION = 'docly_docs_page_id';

export default function App() {
	const [ pages, setPages ] = useState( [] );
	const [ pageId, setPageId ] = useState( 0 );
	const [ loading, setLoading ] = useState( true );
	const [ saving, setSaving ] = useState( false );
	const [ notice, setNotice ] = useState( null );

	useEffect( () => {
		Promise.all( [
			apiFetch( {
				path: '/wp/v2/pages?per_page=100&status=publish&orderby=title&order=asc&_fields=id,title',
			} ),
			apiFetch( { path: '/wp/v2/settings' } ),
		] )
			.then( ( [ pageList, settings ] ) => {
				setPages( pageList );
				setPageId( settings[ OPTION ] || 0 );
			} )
			.catch( ( error ) =>
				setNotice( { status: 'error', message: error.message } )
			)
			.finally( () => setLoading( false ) );
	}, [] );

	const save = () => {
		setSaving( true );
		setNotice( null );

		apiFetch( {
			path: '/wp/v2/settings',
			method: 'POST',
			data: { [ OPTION ]: pageId },
		} )
			.then( () =>
				setNotice( {
					status: 'success',
					message: __( 'Settings saved.', 'docly' ),
				} )
			)
			.catch( ( error ) =>
				setNotice( { status: 'error', message: error.message } )
			)
			.finally( () => setSaving( false ) );
	};

	const options = [
		{ label: __( '— Select a page —', 'docly' ), value: 0 },
		...pages.map( ( page ) => ( {
			label: page.title.rendered || __( '(no title)', 'docly' ),
			value: page.id,
		} ) ),
	];

	return (
		<>
			<h1>{ __( 'Docly Settings', 'docly' ) }</h1>

			{ notice && (
				<Notice
					status={ notice.status }
					onRemove={ () => setNotice( null ) }
				>
					{ notice.message }
				</Notice>
			) }

			<Card>
				<CardHeader>
					<strong>{ __( 'General', 'docly' ) }</strong>
				</CardHeader>
				<CardBody>
					{ loading ? (
						<Spinner />
					) : (
						<>
							<SelectControl
								label={ __( 'Main Docs Page', 'docly' ) }
								help={ __(
									'The page used as the main Documentation page.',
									'docly'
								) }
								value={ pageId }
								options={ options }
								onChange={ ( value ) =>
									setPageId( parseInt( value, 10 ) )
								}
								__nextHasNoMarginBottom
							/>
							<Button
								variant="primary"
								onClick={ save }
								isBusy={ saving }
								disabled={ saving }
								style={ { marginTop: '16px' } }
							>
								{ __( 'Save Settings', 'docly' ) }
							</Button>
						</>
					) }
				</CardBody>
			</Card>
		</>
	);
}
