try {
    // ...existing code to access device...
} catch (error) {
    if (error.name === 'NotFoundError') {
        console.error('Requested device not found:', error);
    } else {
        console.error('An unexpected error occurred:', error);
    }
}