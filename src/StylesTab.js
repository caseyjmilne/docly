import { useEffect, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import {
	Button,
	Card,
	CardBody,
	CardHeader,
	Notice,
	Spinner,
	__experimentalInputControl as InputControl,
	__experimentalInputControlSuffixWrapper as InputControlSuffixWrapper,
} from '@wordpress/components';

const OPTION = 'docly_max_width';

// InputControl shows its own draft while focused, so non-digits are
// blocked before they reach the field rather than stripped afterwards.
const blockNonDigitKeys = ( event ) => {
	if (
		event.key.length === 1 &&
		! /\d/.test( event.key ) &&
		! event.ctrlKey &&
		! event.metaKey
	) {
		event.preventDefault();
	}
};

const pasteDigitsOnly = ( event ) => {
	const text = event.clipboardData.getData( 'text' );

	if ( /\D/.test( text ) ) {
		event.preventDefault();
	}
};
const LIMITS = window.doclyAdmin?.maxWidth || {
	default: 1200,
	min: 320,
	max: 3840,
};

export default function StylesTab() {
	// Kept as a string so the field can be empty while typing.
	const [ maxWidth, setMaxWidth ] = useState( '' );
	const [ loading, setLoading ] = useState( true );
	const [ saving, setSaving ] = useState( false );
	const [ notice, setNotice ] = useState( null );

	useEffect( () => {
		apiFetch( { path: '/wp/v2/settings' } )
			.then( ( settings ) =>
				setMaxWidth( String( settings[ OPTION ] || LIMITS.default ) )
			)
			.catch( ( error ) =>
				setNotice( { status: 'error', message: error.message } )
			)
			.finally( () => setLoading( false ) );
	}, [] );

	const value = parseInt( maxWidth, 10 );
	const valid = value >= LIMITS.min && value <= LIMITS.max;

	const save = () => {
		setSaving( true );
		setNotice( null );

		apiFetch( {
			path: '/wp/v2/settings',
			method: 'POST',
			data: { [ OPTION ]: value },
		} )
			.then( ( settings ) => {
				setMaxWidth( String( settings[ OPTION ] ) );
				setNotice( {
					status: 'success',
					message: __( 'Settings saved.', 'docly' ),
				} );
			} )
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
					<strong>{ __( 'Layout', 'docly' ) }</strong>
				</CardHeader>
				<CardBody>
					{ loading ? (
						<Spinner />
					) : (
						<>
							<div className="docly-styles__field">
								<InputControl
									label={ __( 'Max width', 'docly' ) }
									help={
										valid
											? sprintf(
													/* translators: %d: default width in px */
													__(
														'Maximum width of the docs header and content. Default: %dpx.',
														'docly'
													),
													LIMITS.default
											  )
											: sprintf(
													/* translators: 1: minimum px, 2: maximum px */
													__(
														'Enter a whole number between %1$d and %2$d.',
														'docly'
													),
													LIMITS.min,
													LIMITS.max
											  )
									}
									type="text"
									inputMode="numeric"
									pattern="[0-9]*"
									maxLength={ 4 }
									onKeyDown={ blockNonDigitKeys }
									onPaste={ pasteDigitsOnly }
									onDrop={ ( event ) => event.preventDefault() }
									value={ maxWidth }
									onChange={ ( next ) =>
										setMaxWidth(
											( next || '' ).replace( /\D/g, '' ).slice( 0, 4 )
										)
									}
									suffix={
										<InputControlSuffixWrapper>
											px
										</InputControlSuffixWrapper>
									}
									__next40pxDefaultSize
								/>
							</div>
							<div className="docly-styles__actions">
								<Button
									variant="primary"
									onClick={ save }
									isBusy={ saving }
									disabled={ saving || ! valid }
								>
									{ __( 'Save Settings', 'docly' ) }
								</Button>
								<Button
									variant="tertiary"
									onClick={ () =>
										setMaxWidth( String( LIMITS.default ) )
									}
									disabled={
										saving || value === LIMITS.default
									}
								>
									{ __( 'Reset to default', 'docly' ) }
								</Button>
							</div>
						</>
					) }
				</CardBody>
			</Card>
		</>
	);
}
