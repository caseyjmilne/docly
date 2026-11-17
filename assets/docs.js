/**
 * Docly: load docs into the article area without a page refresh.
 */
( function () {
	'use strict';

	var config = window.doclyDocs || {};
	var nav = document.querySelector( '.docly-nav' );
	var article = document.getElementById( 'docly-article' );

	if ( ! nav || ! article || ! config.restUrl || ! window.fetch ) {
		return;
	}

	var cache = new Map();
	var pending = null;

	function getLinks() {
		return nav.querySelectorAll( '.docly-nav__link' );
	}

	function findLink( id ) {
		return nav.querySelector( '.docly-nav__link[data-doc-id="' + id + '"]' );
	}

	function setActive( id ) {
		getLinks().forEach( function ( link ) {
			var active = link.getAttribute( 'data-doc-id' ) === String( id );
			link.classList.toggle( 'is-active', active );
			if ( active ) {
				link.setAttribute( 'aria-current', 'page' );
			} else {
				link.removeAttribute( 'aria-current' );
			}
		} );
	}

	function fetchDoc( id ) {
		if ( cache.has( id ) ) {
			return Promise.resolve( cache.get( id ) );
		}

		var url = config.restUrl + encodeURIComponent( id ) + '?_fields=id,title,content';

		return fetch( url, { credentials: 'same-origin' } )
			.then( function ( response ) {
				if ( ! response.ok ) {
					throw new Error( 'HTTP ' + response.status );
				}
				return response.json();
			} )
			.then( function ( doc ) {
				cache.set( id, doc );
				return doc;
			} );
	}

	function render( doc ) {
		article.setAttribute( 'data-doc-id', doc.id );
		article.innerHTML =
			'<h1 class="docly-article__title"></h1>' +
			'<div class="docly-article__content"></div>';
		// Title comes back HTML-rendered from WordPress; content is post HTML.
		article.querySelector( '.docly-article__title' ).innerHTML = doc.title.rendered;
		article.querySelector( '.docly-article__content' ).innerHTML = doc.content.rendered;
	}

	function load( id, href, push ) {
		if ( String( id ) === article.getAttribute( 'data-doc-id' ) && push ) {
			return;
		}

		var request = {};
		pending = request;

		setActive( id );
		article.classList.add( 'is-loading' );
		article.setAttribute( 'aria-busy', 'true' );

		fetchDoc( id )
			.then( function ( doc ) {
				// Ignore responses for clicks that have since been superseded.
				if ( pending !== request ) {
					return;
				}
				render( doc );
				if ( push ) {
					history.pushState( { doclyDocId: id }, '', href );
				}
				article.focus( { preventScroll: true } );
				window.scrollTo( { top: 0 } );
			} )
			.catch( function () {
				if ( pending !== request ) {
					return;
				}
				// Fall back to a normal navigation so the server renders it.
				window.location.href = href;
			} )
			.finally( function () {
				if ( pending === request ) {
					article.classList.remove( 'is-loading' );
					article.removeAttribute( 'aria-busy' );
				}
			} );
	}

	nav.addEventListener( 'click', function ( event ) {
		var link = event.target.closest( '.docly-nav__link' );

		if (
			! link ||
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}

		event.preventDefault();
		load( link.getAttribute( 'data-doc-id' ), link.href, true );
	} );

	window.addEventListener( 'popstate', function ( event ) {
		var id = event.state && event.state.doclyDocId;

		if ( ! id ) {
			// Initial entry: restore the doc the server rendered for this URL.
			var slug = new URL( window.location.href ).searchParams.get( 'docly' );
			var link = slug
				? nav.querySelector( '.docly-nav__link[data-doc-slug="' + CSS.escape( slug ) + '"]' )
				: getLinks()[ 0 ];
			id = link && link.getAttribute( 'data-doc-id' );
		}

		if ( id && findLink( id ) ) {
			load( id, window.location.href, false );
		}
	} );

	// Seed history so "back" to the first entry knows which doc it showed.
	var initialId = article.getAttribute( 'data-doc-id' );
	if ( initialId ) {
		history.replaceState( { doclyDocId: initialId }, '', window.location.href );
	}
	article.setAttribute( 'tabindex', '-1' );
} )();
