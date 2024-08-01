import { Component, Input, Output, EventEmitter, ViewChild, ViewChildren, AfterViewInit, OnDestroy, ElementRef, signal, QueryList, ChangeDetectorRef, OnInit } from '@angular/core';
import { OfVirtualTree, OfTreeConfig, OfVirtualTreeComponent } from '../virtual-tree';
import { Node, VirtualRenderArea } from '../../models';
import { LogMethods } from '../../../utils';

/**
 * State accessor providing behavior state given a data item
 */
export interface VtItemState<T> {
    /**
     * True if the passed item is expanded
     */
    isExpanded: (item: T) => boolean;
    /**
     * True if the passed item is selected
     */
    isSelected: (item: T) => boolean;
    /**
     * True if the passed item is highlighted
     */
    isHighlighted: (item: T) => boolean;
    /**
     * True if the passed item is loading its children
     */
    isLoading: (item: any) => boolean;
}

/**
 * Configuration options for the VtBasicTree
 */
export interface VtBasicTreeConfig<T> extends OfTreeConfig<T> {
    /**
     * Number of milliseconds to wait before applying the after change of input [filterText] or [filter] handler
     */
    filterThrottle: number;
    /**
     * Minimum number of characters permitted for applying [filterText] filter
     */
    filterTextMinLength: number;
    /**
     * Icon to use for non-folder nodes. This is overidden by the getIcon option
     */
    itemIcon: string;
    /**
     * Handler for customizing the item icon. The returned string will be applied as a class on the template's i tag
     * For example, if your project uses font awesome you might return 'fa fa-file-o'
     * @param item The data item which the icon should represent
     * @param node The node for the data item
     * @param state State accessor for the item, used to customize icon based on expanded, loading, selected, or highlighted state
     */
    getIcon(item: T, node: Node<T>, state: VtItemState<T>): string;
    /**
     * Handler for customizing the label for tree nodes. The returned string will be used as the node text for the passed item
     * @param item The data item which the text should represent
     * @param state State accessor for the item, exposing the item's expanded, loading, selected, or highlighted state
     */
    getName(item: T, state: VtItemState<T>): string;
    /**
     * @ignore
     */
    getDomNodeAttr(item: T, node: Node<T>, state: VtItemState<T>): { [attr: string]: any } | undefined;
}

export enum DefaultIcons {
    file = 'of-file-text',
    folder = 'of-folder',
    folderOpen = 'of-folder-open'
}

@Component({
    selector: 'of-basic-tree',
    templateUrl: `./basic-tree.component.html`,
    styleUrls: [`./basic-tree.component.style.scss`]
})
export class OfBasicTreeComponent implements AfterViewInit, OnDestroy {
    private disposers: (() => void)[] = [];
    private filterTextThrottle: any;
    private _filterText: string | undefined = '';
    private loadingItems = new Set<any>();
    private ownId = Math.random().toString();

    private stateProvider = Object.seal({
        isExpanded: (item: any) => this.model.isExpanded(item),
        isSelected: (item: any) => this.model.isSelected(item),
        isHighlighted: (item: any) => this.model.isHighlighted(item),
        isLoading: (item: any) => this.isItemLoading(item)
    }) as VtItemState<any>;
    private _model: OfVirtualTree<any>;
    private _config: VtBasicTreeConfig<any> = {
        childAccessor: (item: any) => this.getChildren(item),
        getIcon: (item: any) =>
            item.type !== 'd' && item.type !== 'Folder'
                ? item.icon || this.config.itemIcon
                : this.model.isExpanded(item)
                ? DefaultIcons.folderOpen
                : DefaultIcons.folder,
        getName: (item: any) => item.name,
        getDomNodeAttr: () => undefined,
        itemIcon: DefaultIcons.file,
        filterThrottle: 500,
        filterTextMinLength: 2,
        lazyLoad: true,
    };

    /**
     * @ignore
     */
    @ViewChild(OfVirtualTreeComponent)
    public tree!: OfVirtualTreeComponent;

    /**
     * Fires on change of the selected item, [selection]
     */
    @Output()
    public selectionChange = new EventEmitter<any>();

    /**
     * ContextMenu event on tree rows, allows custom right-click menus
     */
    @Output()
    public itemContextMenu = new EventEmitter<{ event: MouseEvent; item: any }>();

    /**
     * Click event that fires on click of the icon portion of a tree row
     */
    @Output()
    public iconClick = new EventEmitter<{ event: MouseEvent; item: any }>();

    /**
     * Click event that fires on click of the label portion of a tree row
     */
    @Output()
    public labelClick = new EventEmitter<{ event: MouseEvent; item: any }>();

    /**
     * Click event that fires on click of any part of a tree row
     */
    @Output()
    public rowClick = new EventEmitter<{ event: MouseEvent; item: any }>();

    /**
     * Height in pixels of each row in the tree
     */
    @Input()
    public itemHeight: number;

    private childAccessor = (item: any) => item.children;

    /**
     * Allows applying an arbitrary filter to the tree. This overrides filterText
     */
    @Input()
    public set filter(value: ((item: any) => boolean) | undefined) {
        this.model.setFilter(value);
    }

    /**
     * Filter the tree with default text filter, case insenstive contains on item names
     */
    @Input()
    public set filterText(value: string | undefined) {
        this.handleFilterTextChange(value);
    }

    /**
     * The config for the tree
     */
    @Input()
    public set config(value: Partial<VtBasicTreeConfig<any>>) {
        this.childAccessor = value.childAccessor || this.childAccessor;
        this._config = { ...this._config, ...value, childAccessor: this.config.childAccessor };
        this.model.updateConfig(this.config);
    }
    public get config() {
        return this._config;
    }

    /**
     * returns true if filterText or a filter function is applied
     */
    public get isFiltered() {
        return this.model.isFiltered();
    }

    /**
     * Get the current model or set a custom model for the tree
     */
    @Input()
    public set model(value: OfVirtualTree<any>) {
        this._model = value;
        this.bindModelEvents();
    }
    public get model() {
        return this._model;
    }

    /**
     * Input for loading data into the tree
     */
    @Input()
    public set data(items: any[]) {
        this.model.load(items);
    }

    /**
     * Input for the selected item
     */
    @Input()
    public set selection(value: any) {
        if (!this.model.isSelected(value)) {
            this.model.select(value);
            this.navigateToSelection();
        }
    }

    public renderArea = new VirtualRenderArea();

    @ViewChildren('expanded', { read: ElementRef })
    public readonly expandedNodesRefs!: QueryList<ElementRef>;

    public heightAdjustment!: number;

    constructor(private host: ElementRef<HTMLElement>, private readonly cdr: ChangeDetectorRef) {
        this._model = new OfVirtualTree<any>(this.config);
        this.bindModelEvents();
        this.itemHeight = 1.5 * parseFloat(window.getComputedStyle(document.body).fontSize || '16');
        this.renderArea.itemHeight = this.itemHeight;
    }
    
    ngAfterViewInit() {
        setTimeout(() => {
            this.tree.invalidateSize();
            this.model.invalidateData();
        }, 1);
        this.expandedNodesRefs.changes.subscribe((data) => {
            const expandedNode = this.expandedNode();
            console.log(expandedNode);
            
            if (expandedNode && data.first) {
                const index = this.model.getNodeIndex(expandedNode);
                this.renderArea.heightAdjustment = [data.first.nativeElement.offsetHeight, index];
                this.cdr.detectChanges();
            } else if(!expandedNode && !data.first) {
                this.renderArea.heightAdjustment = [0 , 0];
                this.cdr.detectChanges();
            }
        });
    }

    ngOnDestroy() {
        this.disposeSubscriptions();
    }

    /** @ignore */
    public handleContextMenu(evt: MouseEvent, item: any) {
        this.itemContextMenu.emit({ event: evt, item });
    }

    /** @ignore */
    public handleRowClick(evt: MouseEvent, item: any) {
        this.model.selectAndHighlight(item);
        this.rowClick.emit({ event: evt, item });
    }

    /**
     * Scrolls and expands nodes so that the selected item is visible in the tree
     */
    public navigateToSelection() {
        this.model.expandToSelectedItem();
        return this.tree.scrollToSelected();
    }

    /**
     * Scrolls and expands nodes so that the passed item is visible in the tree
     */
    public navigateToItem(item: any) {
        this.model.expandToItem(item);
        return this.tree.scrollToItem(item);
    }

    /** @ignore */
    public getIcon(node: Node<any>) {
        return `of-icon ${this.config.getIcon!(node.item, node, this.stateProvider)}`;
    }

    /** @ignore */
    public getDomNodeAttr(node: Node<any>) {
        return this.config.getDomNodeAttr ? this.config.getDomNodeAttr(node.item, node, this.stateProvider) : undefined;
    }

    /** @ignore */
    public getName(item: any) {
        return this.config.getName!(item, this.stateProvider) || '';
    }

    /** @ignore */
    public getExpanderIcon(item: any) {
        const iconType = this.model.isExpanded(item) ? 'down' : 'right';
        return `of-expander of-expander-${iconType}`;
    }

    private getChildren(item: any) {
        const result = this.childAccessor(item);
        if (result instanceof Promise) {
            this.loadChildren(item, result);
            return undefined;
        }
        return result;
    }

    private async loadChildren(item: any, childrenPromise: Promise<any>) {
        this.loadingItems.add(item);
        try {
            await childrenPromise;
            this.model.invalidateItem(item);
        } finally {
            this.loadingItems.delete(item);
        }
    }

    private isItemLoading(item: any) {
        return this.loadingItems.has(item);
    }

    private bindModelEvents() {
        const selectionHandler = (item: any) => this.selectionChange.emit(item),
            subscription = this.model.onSelectionChanged.subscribe(selectionHandler);

        this.disposeSubscriptions();
        this.disposers.push(() => subscription.unsubscribe());
    }

    private disposeSubscriptions() {
        this.disposers.forEach(d => d());
    }

    private handleFilterTextChange(value: string | undefined) {
        if (value && value.length > this.config.filterTextMinLength!) {
            this.setTextFilter(value);
        } else {
            this.clearTextFilter();
        }
        this._filterText = value;
    }

    private setTextFilter(value: string) {
        const text = value.toLowerCase();

        clearTimeout(this.filterTextThrottle);
        this.filterTextThrottle = setTimeout(
            () =>
                this.model.setFilter(
                    item =>
                        this.getName(item)
                            .toLowerCase()
                            .indexOf(text) >= 0
                ),
            this.config.filterThrottle
        );
    }

    private clearTextFilter() {
        if (this._filterText && this._filterText.length > this.config.filterTextMinLength!) {
            clearTimeout(this.filterTextThrottle);
            this.model.setFilter(undefined);
            this.model.expandToSelectedItem();
            this.tree.scrollToSelected();
        }
    }

    public expandedNode = signal<Node<unknown> | null>(null);
    public expandNode(node: any) {
        this.expandedNode() === node ? this.expandedNode.set(null) : this.expandedNode.set(node);
    }
}
