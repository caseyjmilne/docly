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
	TextControl,
} from '@wordpress/components';

const OPTION = 'docly_max_width';
const BG_OPTION = 'docly_bg_color';
const TEXT_OPTION = 'docly_text_color';
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

// Empty is valid: it means inherit from the theme.
const isValidColor = ( color ) => color.trim() === '' || HEX.test( color.trim() );

/**
 * Hex color input with swatch preview and Clear. Empty = inherit theme.
 */
function ColorField( { label, help, value, onChange, disabled } ) {
	const color = value.trim();
	const valid = isValidColor( value );

	return (
		<div className="docly-styles__field docly-styles__color">
			<TextControl
				label={ label }
				help={
					valid
						? help
						: __(
								'Enter a hex color like #fff or #1e1e1e, or leave empty.',
								'docly'
						  )
				}
				placeholder={ __( 'Inherit from theme', 'docly' ) }
				value={ value }
				onChange={ ( next ) => onChange( next.slice( 0, 9 ) ) }
				spellCheck={ false }
				autoComplete="off"
				__next40pxDefaultSize
				__nextHasNoMarginBottom
			/>
			<span
				className={
					'docly-styles__swatch' + ( color && valid ? '' : ' is-empty' )
				}
				style={ color && valid ? { background: color } : undefined }
				aria-hidden="true"
			/>
			<Button
				variant="tertiary"
				size="compact"
				onClick={ () => onChange( '' ) }
				disabled={ disabled || ! value }
				aria-label={ sprintf(
					/* translators: %s: field label */
					__( 'Clear %s', 'docly' ),
					label
				) }
			>
				{ __( 'Clear', 'docly' ) }
			</Button>
		</div>
	);
}

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
	// Empty means inherit the theme background.
	const [ bgColor, setBgColor ] = useState( '' );
	const [ textColor, setTextColor ] = useState( '' );
	const [ loading, setLoading ] = useState( true );
	const [ saving, setSaving ] = useState( false );
	const [ notice, setNotice ] = useState( null );

	useEffect( () => {
		apiFetch( { path: '/wp/v2/settings' } )
			.then( ( settings ) => {
				setMaxWidth( String( settings[ OPTION ] || LIMITS.default ) );
				setBgColor( settings[ BG_OPTION ] || '' );
				setTextColor( settings[ TEXT_OPTION ] || '' );
				setTextColor( settings[ TEXT_OPTION ] || '' );
			} )
			.catch( ( error ) =>
				setNotice( { status: 'error', message: error.message } )
			)
			.finally( () => setLoading( false ) );
	}, [] );

	const value = parseInt( maxWidth, 10 );
	const widthValid = value >= LIMITS.min && value <= LIMITS.max;
	const valid =
		widthValid && isValidColor( bgColor ) && isValidColor( textColor );

	const save = () => {
		setSaving( true );
		setNotice( null );

		apiFetch( {
			path: '/wp/v2/settings',
			method: 'POST',
			data: {
				[ OPTION ]: value,
				[ BG_OPTION ]: bgColor.trim(),
				[ TEXT_OPTION ]: textColor.trim(),
			},
		} )
			.then( ( settings ) => {
				setMaxWidth( String( settings[ OPTION ] ) );
				setBgColor( settings[ BG_OPTION ] || '' );
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
										widthValid
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
							<ColorField
								label={ __( 'Background color', 'docly' ) }
								help={ __(
									'Hex color, e.g. #ffffff. Leave empty to use the theme background.',
									'docly'
								) }
								value={ bgColor }
								onChange={ setBgColor }
								disabled={ saving }
							/>
							<ColorField
								label={ __( 'Text color', 'docly' ) }
								help={ __(
									'Hex color, e.g. #1e1e1e. Leave empty to use the theme text color.',
									'docly'
								) }
								value={ textColor }
								onChange={ setTextColor }
								disabled={ saving }
							/>
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
									{ __( 'Reset width', 'docly' ) }
								</Button>
							</div>
						</>
					) }
				</CardBody>
			</Card>
		</>
	);
}
