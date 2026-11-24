import { useCallback, useEffect, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';
import { useDebounce } from '@wordpress/compose';
import { decodeEntities } from '@wordpress/html-entities';
import { __ } from '@wordpress/i18n';
import {
	Button,
	Card,
	CardBody,
	CardHeader,
	ComboboxControl,
	Notice,
	Spinner,
} from '@wordpress/components';

const OPTION = 'docly_docs_page_id';
const PAGE_FIELDS = 'id,title';

const toOption = ( page ) => ( {
	value: page.id,
	label: decodeEntities( page.title.rendered ) || __( '(no title)', 'docly' ),
} );

export default function SettingsTab() {
	const [ pageId, setPageId ] = useState( 0 );
	const [ selected, setSelected ] = useState( null );
	const [ results, setResults ] = useState( [] );
	const [ searching, setSearching ] = useState( false );
	const [ loading, setLoading ] = useState( true );
	const [ saving, setSaving ] = useState( false );
	const [ notice, setNotice ] = useState( null );

	const searchPages = useCallback( ( search ) => {
		setSearching( true );
		apiFetch( {
			path: addQueryArgs( '/wp/v2/pages', {
				search,
				per_page: 20,
				status: 'publish',
				_fields: PAGE_FIELDS,
			} ),
		} )
			.then( ( pages ) => setResults( pages.map( toOption ) ) )
			.catch( () => setResults( [] ) )
			.finally( () => setSearching( false ) );
	}, [] );

	const debouncedSearch = useDebounce( searchPages, 300 );

	useEffect( () => {
		apiFetch( { path: '/wp/v2/settings' } )
			.then( ( settings ) => {
				const id = settings[ OPTION ] || 0;
				setPageId( id );

				if ( ! id ) {
					return;
				}

				return apiFetch( {
					path: addQueryArgs( `/wp/v2/pages/${ id }`, {
						_fields: PAGE_FIELDS,
					} ),
				} )
					.then( ( page ) => setSelected( toOption( page ) ) )
					.catch( () => setSelected( null ) );
			} )
			.catch( ( error ) =>
				setNotice( { status: 'error', message: error.message } )
			)
			.finally( () => setLoading( false ) );

		searchPages( '' );
	}, [ searchPages ] );

	const options = selected
		? [ selected, ...results.filter( ( o ) => o.value !== selected.value ) ]
		: results;

	const onChange = ( value ) => {
		const id = value ? parseInt( value, 10 ) : 0;
		setPageId( id );
		setSelected( options.find( ( o ) => o.value === id ) || null );
	};

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

	return (
		<>
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
							<ComboboxControl
								label={ __( 'Main Docs Page', 'docly' ) }
								help={ __(
									'Start typing to search published pages.',
									'docly'
								) }
								value={ pageId || null }
								options={ options }
								onChange={ onChange }
								onFilterValueChange={ debouncedSearch }
								isLoading={ searching }
								allowReset
								__next40pxDefaultSize
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
