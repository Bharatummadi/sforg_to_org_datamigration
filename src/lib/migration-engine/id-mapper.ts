export class IdMapper {
    private encodingMap = new Map<string, string>(); // SourceId -> TargetId

    constructor() { }

    /**
     * Register a new mapping.
     */
    set(sourceId: string, targetId: string) {
        this.encodingMap.set(sourceId, targetId);
    }

    /**
     * Retrieve the target ID for a given source ID.
     */
    get(sourceId: string): string | undefined {
        return this.encodingMap.get(sourceId);
    }

    /**
     * returns true if the source ID has already been mapped.
     */
    has(sourceId: string): boolean {
        return this.encodingMap.has(sourceId);
    }

    /**
     * Returns all source IDs.
     */
    getAllSourceIds(): string[] {
        return Array.from(this.encodingMap.keys());
    }

    /**
     * Clear the map.
     */
    clear() {
        this.encodingMap.clear();
    }
}
