import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { decodeEntities } from '@wordpress/html-entities';
import { __, sprintf } from '@wordpress/i18n';
import { Button, Notice, Spinner } from '@wordpress/components';
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

function DocList( { docIds, docs } ) {
	return (
		<SortableContext
			items={ docIds.map( docDndId ) }
			strategy={ verticalListSortingStrategy }
		>
			<ul className="docly-pos__docs">
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

function Chevron( { open, onToggle, name } ) {
	return (
		<button
			type="button"
			className={ 'docly-pos__chevron' + ( open ? ' is-open' : '' ) }
			aria-expanded={ open }
			aria-label={ sprintf(
				/* translators: %s: group name */
				open ? __( 'Collapse %s', 'docly' ) : __( 'Expand %s', 'docly' ),
				name
			) }
			onClick={ onToggle }
		>
			<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
				<path d="M10 6 8.6 7.4l4.6 4.6-4.6 4.6L10 18l6-6z" />
			</svg>
		</button>
	);
}

function GroupHeader( { name, count, open, onToggle, handleProps } ) {
	return (
		<div className="docly-pos__group-header">
			{ onToggle && (
				<Chevron open={ open } onToggle={ onToggle } name={ name } />
			) }
			<span
				className={
					'docly-pos__group-handle' + ( handleProps ? ' is-draggable' : '' )
				}
				{ ...( handleProps || {} ) }
			>
				{ handleProps && (
					<span className="docly-pos__grip" aria-hidden="true">
						⋮⋮
					</span>
				) }
				<span className="docly-pos__group-name">{ name }</span>
			</span>
			<span className="docly-pos__count">{ count }</span>
		</div>
	);
}

/**
 * A group card. The whole card is a drop zone, so docs can be dropped on a
 * collapsed group (or its header) and are appended to the end.
 */
function GroupCard( {
	containerKey,
	name,
	docIds,
	docs,
	open,
	onToggle,
	sortable,
	className = '',
} ) {
	const { setNodeRef: setDropRef, isOver } = useDroppable( {
		id: zoneDndId( containerKey ),
	} );

	return (
		<section
			ref={ sortable?.setNodeRef }
			style={ sortable?.style }
			className={
				'docly-pos__group' +
				( className ? ' ' + className : '' ) +
				( sortable?.isDragging ? ' is-dragging' : '' ) +
				( open ? '' : ' is-collapsed' )
			}
		>
			<div
				ref={ setDropRef }
				className={ 'docly-pos__group-inner' + ( isOver ? ' is-over' : '' ) }
			>
				<GroupHeader
					name={ name }
					count={ docIds.length }
					open={ open }
					onToggle={ onToggle }
					handleProps={ sortable?.handleProps }
				/>
				{ open && <DocList docIds={ docIds } docs={ docs } /> }
			</div>
		</section>
	);
}

function SortableGroup( { group, ...props } ) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable( { id: groupDndId( group.id ) } );

	return (
		<GroupCard
			{ ...props }
			containerKey={ group.id }
			name={ group.name }
			sortable={ {
				setNodeRef,
				isDragging,
				handleProps: { ...attributes, ...listeners },
				style: {
					transform: CSS.Transform.toString( transform ),
					transition,
				},
			} }
		/>
	);
}

export default function PositioningTab() {
	const [ board, setBoard ] = useState( null );
	const [ activeId, setActiveId ] = useState( null );
	const [ status, setStatus ] = useState( 'idle' );
	const [ error, setError ] = useState( null );
	// Groups always start open; collapsing is a temporary drag helper and
	// is intentionally not remembered between visits.
	const [ collapsed, updateCollapsed ] = useState( [] );

	const toggle = ( key ) =>
		updateCollapsed(
			collapsed.includes( key )
				? collapsed.filter( ( k ) => k !== key )
				: [ ...collapsed, key ]
		);

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

		// Collapsed groups don't render their docs, so moving the dragged doc
		// into one mid-drag would unmount it. Those moves happen on drop.
		if ( ! from || ! to || from === to || collapsed.includes( to ) ) {
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

			const overKey = findContainer( over.id );

			if ( key && overKey && key !== overKey ) {
				// Dropped on a collapsed group: append to the end of it.
				next = {
					...board,
					containers: {
						...containers,
						[ key ]: containers[ key ].filter(
							( id ) => id !== activeParsed.id
						),
						[ overKey ]: [
							...containers[ overKey ].filter(
								( id ) => id !== activeParsed.id
							),
							activeParsed.id,
						],
					},
				};
			} else if ( key && overParsed.type === 'doc' && key === overKey ) {
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
				<span className="docly-pos__actions">
					<Button
						variant="tertiary"
						size="small"
						onClick={ () => updateCollapsed( [] ) }
					>
						{ __( 'Expand all', 'docly' ) }
					</Button>
					<Button
						variant="tertiary"
						size="small"
						onClick={ () =>
							updateCollapsed( Object.keys( containers ) )
						}
					>
						{ __( 'Collapse all', 'docly' ) }
					</Button>
				</span>
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
						strategy={ verticalListSortingStrategy }
					>
						{ groups.map( ( group ) => (
							<SortableGroup
								key={ group.id }
								group={ group }
								docIds={ containers[ group.id ] }
								docs={ docs }
								open={ ! collapsed.includes( group.id ) }
								onToggle={ () => toggle( group.id ) }
							/>
						) ) }
					</SortableContext>

					<GroupCard
						containerKey={ UNGROUPED }
						name={ __( 'Ungrouped', 'docly' ) }
						docIds={ containers[ UNGROUPED ] }
						docs={ docs }
						open={ ! collapsed.includes( UNGROUPED ) }
						onToggle={ () => toggle( UNGROUPED ) }
						className="is-ungrouped"
					/>
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
								handleProps={ {} }
							/>
						</div>
					) }
				</DragOverlay>
			</DndContext>
		</div>
	);
}
