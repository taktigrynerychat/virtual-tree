/**
 * Simple calculator for a virtual render area
 */
export class VirtualRenderArea {
    private _scrollPos = 0;
    private _viewerHeight = 0;
    private _itemCount = 0;
    private _itemHeight = 0;
    private _heightAdjustment = 0;
    private _heightAdjustmentIndex: number | null = null;
    private _visibleCount = 0;
    private _visibleStart = 0;
    private _topBuffer = 0;
    private _totalHeight = 0;

    public set itemHeight(value: number) {
        if (this._itemHeight !== value) {
            this._itemHeight = value;
            this.invalidateViewRange();
            this.invalidateTotalHeight();
            this.invalidateScrollPos();
        }
    }
    public get itemHeight() {
        return this._itemHeight;
    }

    public set heightAdjustment([value, index]: [number, number | null]) {
        this._heightAdjustment = value;
        this._heightAdjustmentIndex = index;
        this.invalidateTotalHeight();
        this.invalidateViewRange();
        this.invalidateScrollPos();
    }
    public get heightAdjustment() {
        return [this._heightAdjustment, this._heightAdjustmentIndex];
    }

    public set itemCount(value: number) {
        if (this._itemCount !== value) {
            this._itemCount = value;
            this.invalidateViewRange();
            this.invalidateTotalHeight();
        }
    }
    public get itemCount() {
        return this._itemCount;
    }

    public set scrollPos(value: number) {
        if (this._scrollPos !== value) {
            this._scrollPos = value;
            this.invalidateViewRange();
        }
    }
    public get scrollPos() {
        return this._scrollPos;
    }

    public set viewerHeight(value: number) {
        if (this._viewerHeight !== value) {
            this._viewerHeight = value;
            this.invalidateViewRange();
            this.invalidateScrollPos();
        }
    }
    public get viewerHeight() {
        return this._viewerHeight;
    }

    public get visibleCount() {
        return this._visibleCount;
    }
    public get visibleStart() {
        return this._visibleStart;
    }
    public get topBuffer() {
        return this._topBuffer;
    }
    public get totalHeight() {
        return this._totalHeight;
    }

    private invalidateViewRange() {
        const heightAdjustment = this._heightAdjustment ?? 0;

        this._visibleStart = Math.max(0, Math.floor(this._scrollPos / this._itemHeight - (heightAdjustment / this._itemHeight)));
        
        const isHeightAdjustmentApplicable = this._heightAdjustmentIndex !== null && this._visibleStart > this._heightAdjustmentIndex;

        const maxItems = isHeightAdjustmentApplicable
        ? Math.ceil(this._viewerHeight / this._itemHeight)
        : Math.max(1, Math.ceil(this._viewerHeight / this._itemHeight + 1 - (heightAdjustment / this._itemHeight)));
        
        this._visibleCount = Math.max(Math.ceil(this._viewerHeight / this._itemHeight), maxItems)

        this._topBuffer = isHeightAdjustmentApplicable
        ? this._visibleStart * this._itemHeight + heightAdjustment
        : this._visibleStart * this._itemHeight;

        console.table({
            maxItems,
            _heightAdjustment: this._heightAdjustment,
            _heightAdjustmentIndex: this._heightAdjustmentIndex,
            _visibleStart: this._visibleStart,
            _visibleCount: this._visibleCount,
            _topBuffer: this._topBuffer
        });
    }

    private invalidateTotalHeight() {
        this._totalHeight = this._itemHeight * this._itemCount + (this._heightAdjustment ?? 0);
    }

    private invalidateScrollPos() {
        this._scrollPos = Math.min(Math.max(0, this._totalHeight - this._viewerHeight), this._scrollPos);
    }
}
