import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { decodeEntities } from '@wordpress/html-entities';
import { __, sprintf } from '@wordpress/i18n';
import { Notice, Spinner } from '@wordpress/components';
import {
	DndContext,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	closestCorners,
	pointerWithin,
	useDroppable,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import {
	SortableContext,
	arrayMove,
	rectSortingStrategy,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const PATH = '/docly/v1/structure';

// Container key for docs with no group.
const UNGROUPED = '0';

// dnd-kit ids are namespaced so groups, docs and drop zones never collide.
const groupDndId = ( id ) => `group-${ id }`;
const docDndId = ( id ) => `doc-${ id }`;
const zoneDndId = ( key ) => `zone-${ key }`;
const parseDndId = ( dndId ) => {
	const [ type, id ] = String( dndId ).split( '-' );
	return { type, id };
};

const STATUS_LABELS = {
	draft: __( 'Draft', 'docly' ),
	pending: __( 'Pending', 'docly' ),
	private: __( 'Private', 'docly' ),
	future: __( 'Scheduled', 'docly' ),
};

/**
 * Turn the REST structure into board state.
 *
 * @param {Object} data Response from GET/POST /docly/v1/structure.
 */
function toBoard( data ) {
	const groups = data.groups.map( ( group ) => ( {
		id: String( group.id ),
		name: decodeEntities( group.name ),
	} ) );

	const docs = {};
	const containers = { [ UNGROUPED ]: [] };
	groups.forEach( ( group ) => ( containers[ group.id ] = [] ) );

	// Docs arrive in position order, so pushing keeps each group sorted.
	data.docs.forEach( ( doc ) => {
		const id = String( doc.id );
		const key = containers[ String( doc.group ) ] ? String( doc.group ) : UNGROUPED;

		docs[ id ] = {
			id,
			title: decodeEntities( doc.title ) || __( '(no title)', 'docly' ),
			status: doc.status,
		};
		containers[ key ].push( id );
	} );

	return { groups, docs, containers };
}

/**
 * Build the save payload, including term moves since the last save.
 *
 * @param {Object} saved Last saved { groups, containers }.
 * @param {Object} next  Current { groups, containers }.
 */
function toPayload( saved, next ) {
	const savedKeyOf = {};
	Object.entries( saved.containers ).forEach( ( [ key, ids ] ) =>
		ids.forEach( ( id ) => ( savedKeyOf[ id ] = key ) )
	);

	const moves = [];
	const docs = {};

	Object.entries( next.containers ).forEach( ( [ key, ids ] ) => {
		docs[ key ] = ids.map( Number );
		ids.forEach( ( id ) => {
			if ( savedKeyOf[ id ] !== undefined && savedKeyOf[ id ] !== key ) {
				moves.push( {
					doc: Number( id ),
					from: Number( savedKeyOf[ id ] ),
					to: Number( key ),
				} );
			}
		} );
	} );

	return {
		groups: next.groups.map( ( group ) => Number( group.id ) ),
		docs,
		moves,
	};
}

function DocRow( { doc, overlay = false } ) {
	return (
		<div className={ 'docly-pos__doc' + ( overlay ? ' is-overlay' : '' ) }>
			<span className="docly-pos__grip" aria-hidden="true">
				⋮⋮
			</span>
			<span className="docly-pos__doc-title">{ doc.title }</span>
			{ STATUS_LABELS[ doc.status ] && (
				<span className="docly-pos__status">
					{ STATUS_LABELS[ doc.status ] }
				</span>
			) }
		</div>
	);
}

function SortableDoc( { doc } ) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable( { id: docDndId( doc.id ) } );

	return (
		<li
			ref={ setNodeRef }
			className={ 'docly-pos__doc-item' + ( isDragging ? ' is-dragging' : '' ) }
			style={ {
				transform: CSS.Transform.toString( transform ),
				transition,
			} }
			{ ...attributes }
			{ ...listeners }
		>
			<DocRow doc={ doc } />
		</li>
	);
}

function DocList( { containerKey, docIds, docs } ) {
	const { setNodeRef, isOver } = useDroppable( {
		id: zoneDndId( containerKey ),
	} );

	return (
		<SortableContext
			items={ docIds.map( docDndId ) }
			strategy={ verticalListSortingStrategy }
		>
			<ul
				ref={ setNodeRef }
				className={ 'docly-pos__docs' + ( isOver ? ' is-over' : '' ) }
			>
				{ docIds.map( ( id ) => (
					<SortableDoc key={ id } doc={ docs[ id ] } />
				) ) }
				{ ! docIds.length && (
					<li className="docly-pos__empty">
						{ __( 'Drop docs here', 'docly' ) }
					</li>
				) }
			</ul>
		</SortableContext>
	);
}

function GroupHeader( { name, count, handleProps = {} } ) {
	return (
		<div className="docly-pos__group-header" { ...handleProps }>
			{ handleProps.role && (
				<span className="docly-pos__grip" aria-hidden="true">
					⋮⋮
				</span>
			) }
			<span className="docly-pos__group-name">{ name }</span>
			<span className="docly-pos__count">{ count }</span>
		</div>
	);
}

function SortableGroup( { group, docIds, docs } ) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable( { id: groupDndId( group.id ) } );

	return (
		<section
			ref={ setNodeRef }
			className={ 'docly-pos__group' + ( isDragging ? ' is-dragging' : '' ) }
			style={ {
				transform: CSS.Transform.toString( transform ),
				transition,
			} }
		>
			<GroupHeader
				name={ group.name }
				count={ docIds.length }
				handleProps={ { ...attributes, ...listeners } }
			/>
			<DocList containerKey={ group.id } docIds={ docIds } docs={ docs } />
		</section>
	);
}

export default function PositioningTab() {
	const [ board, setBoard ] = useState( null );
	const [ activeId, setActiveId ] = useState( null );
	const [ status, setStatus ] = useState( 'idle' );
	const [ error, setError ] = useState( null );

	// Last state confirmed by the server, used to compute term moves.
	const saved = useRef( null );
	// State at drag start, restored if the drag is cancelled.
	const dragStart = useRef( null );
	// Saves run one at a time so moves are always diffed against the server.
	const queue = useRef( Promise.resolve() );

	useEffect( () => {
		apiFetch( { path: PATH } )
			.then( ( data ) => {
				const next = toBoard( data );
				saved.current = next;
				setBoard( next );
			} )
			.catch( ( err ) => setError( err.message ) );
	}, [] );

	const sensors = useSensors(
		useSensor( PointerSensor, { activationConstraint: { distance: 4 } } ),
		useSensor( KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		} )
	);

	const save = useCallback( ( next ) => {
		queue.current = queue.current.then( () => {
			const payload = toPayload( saved.current, next );
			const unchanged =
				JSON.stringify( payload ) ===
				JSON.stringify( toPayload( saved.current, saved.current ) );

			if ( unchanged ) {
				return;
			}

			setStatus( 'saving' );
			setError( null );

			return apiFetch( { path: PATH, method: 'POST', data: payload } )
				.then( () => {
					saved.current = next;
					setStatus( 'saved' );
				} )
				.catch( ( err ) => {
					// Roll back to what the server has.
					setBoard( saved.current );
					setStatus( 'idle' );
					setError( err.message );
				} );
		} );
	}, [] );

	if ( error && ! board ) {
		return (
			<Notice status="error" isDismissible={ false }>
				{ error }
			</Notice>
		);
	}

	if ( ! board ) {
		return <Spinner />;
	}

	const { groups, docs, containers } = board;

	const findContainer = ( dndId ) => {
		const { type, id } = parseDndId( dndId );

		if ( type === 'zone' || type === 'group' ) {
			return containers[ id ] ? id : null;
		}

		return (
			Object.keys( containers ).find( ( key ) =>
				containers[ key ].includes( id )
			) ?? null
		);
	};

	// Groups only collide with groups; docs only with docs and drop zones.
	const collisionDetection = ( args ) => {
		const activeType = parseDndId( args.active.id ).type;

		if ( activeType === 'group' ) {
			return closestCenter( {
				...args,
				droppableContainers: args.droppableContainers.filter(
					( c ) => parseDndId( c.id ).type === 'group'
				),
			} );
		}

		const droppableContainers = args.droppableContainers.filter(
			( c ) => parseDndId( c.id ).type !== 'group'
		);
		const hits = pointerWithin( { ...args, droppableContainers } );

		if ( hits.length ) {
			const docHit = hits.find(
				( hit ) => parseDndId( hit.id ).type === 'doc'
			);
			return docHit ? [ docHit ] : hits;
		}

		return closestCorners( { ...args, droppableContainers } );
	};

	const onDragStart = ( { active } ) => {
		dragStart.current = board;
		setActiveId( active.id );
	};

	// Move docs between groups while dragging so the list previews the drop.
	const onDragOver = ( { active, over } ) => {
		if ( ! over || parseDndId( active.id ).type !== 'doc' ) {
			return;
		}

		const from = findContainer( active.id );
		const to = findContainer( over.id );

		if ( ! from || ! to || from === to ) {
			return;
		}

		setBoard( ( prev ) => {
			const docId = parseDndId( active.id ).id;
			const target = prev.containers[ to ].filter( ( id ) => id !== docId );
			let index = target.length;

			if ( parseDndId( over.id ).type === 'doc' ) {
				const overIndex = target.indexOf( parseDndId( over.id ).id );
				const translated = active.rect.current.translated;
				const below =
					translated &&
					translated.top > over.rect.top + over.rect.height / 2;
				index = overIndex < 0 ? target.length : overIndex + ( below ? 1 : 0 );
			}

			target.splice( index, 0, docId );

			return {
				...prev,
				containers: {
					...prev.containers,
					[ from ]: prev.containers[ from ].filter( ( id ) => id !== docId ),
					[ to ]: target,
				},
			};
		} );
	};

	const onDragEnd = ( { active, over } ) => {
		setActiveId( null );

		let next = board;
		const activeParsed = parseDndId( active.id );

		if ( over && activeParsed.type === 'group' ) {
			const from = groups.findIndex( ( g ) => g.id === activeParsed.id );
			const to = groups.findIndex(
				( g ) => g.id === parseDndId( over.id ).id
			);

			if ( from !== to && to >= 0 ) {
				next = { ...board, groups: arrayMove( groups, from, to ) };
			}
		}

		if ( over && activeParsed.type === 'doc' ) {
			const key = findContainer( active.id );
			const overParsed = parseDndId( over.id );

			if ( key && overParsed.type === 'doc' && key === findContainer( over.id ) ) {
				const list = containers[ key ];
				const from = list.indexOf( activeParsed.id );
				const to = list.indexOf( overParsed.id );

				if ( from !== to ) {
					next = {
						...board,
						containers: {
							...containers,
							[ key ]: arrayMove( list, from, to ),
						},
					};
				}
			}
		}

		setBoard( next );
		save( next );
	};

	const onDragCancel = () => {
		setActiveId( null );
		setBoard( dragStart.current );
	};

	const active = activeId ? parseDndId( activeId ) : null;
	const activeGroup =
		active?.type === 'group' && groups.find( ( g ) => g.id === active.id );

	return (
		<div className="docly-pos">
			<div className="docly-pos__toolbar">
				<p className="docly-pos__help">
					{ __(
						'Drag groups and docs to reorder. Drag a doc onto another group to move it. Changes save automatically.',
						'docly'
					) }
				</p>
				<span className="docly-pos__save-status" aria-live="polite">
					{ status === 'saving' && __( 'Saving…', 'docly' ) }
					{ status === 'saved' && __( 'Saved', 'docly' ) }
				</span>
			</div>

			{ error && (
				<Notice status="error" onRemove={ () => setError( null ) }>
					{ sprintf(
						/* translators: %s: error message */
						__( 'Could not save order: %s', 'docly' ),
						error
					) }
				</Notice>
			) }

			<DndContext
				sensors={ sensors }
				collisionDetection={ collisionDetection }
				onDragStart={ onDragStart }
				onDragOver={ onDragOver }
				onDragEnd={ onDragEnd }
				onDragCancel={ onDragCancel }
			>
				<div className="docly-pos__board">
					<SortableContext
						items={ groups.map( ( g ) => groupDndId( g.id ) ) }
						strategy={ rectSortingStrategy }
					>
						{ groups.map( ( group ) => (
							<SortableGroup
								key={ group.id }
								group={ group }
								docIds={ containers[ group.id ] }
								docs={ docs }
							/>
						) ) }
					</SortableContext>

					<section className="docly-pos__group is-ungrouped">
						<GroupHeader
							name={ __( 'Ungrouped', 'docly' ) }
							count={ containers[ UNGROUPED ].length }
						/>
						<DocList
							containerKey={ UNGROUPED }
							docIds={ containers[ UNGROUPED ] }
							docs={ docs }
						/>
					</section>
				</div>

				<DragOverlay>
					{ active?.type === 'doc' && docs[ active.id ] && (
						<DocRow doc={ docs[ active.id ] } overlay />
					) }
					{ activeGroup && (
						<div className="docly-pos__group is-overlay">
							<GroupHeader
								name={ activeGroup.name }
								count={ containers[ activeGroup.id ].length }
							/>
						</div>
					) }
				</DragOverlay>
			</DndContext>
		</div>
	);
}
