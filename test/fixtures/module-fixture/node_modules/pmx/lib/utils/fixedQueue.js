function FixedQueue( size, initialValues ){

  // If there are no initial arguments, default it to
  // an empty value so we can call the constructor in
  // a uniform way.
  initialValues = (initialValues || []);

  // Create the fixed queue array value.
  var queue = Array.apply( null, initialValues );

  // Store the fixed size in the queue.
  queue.fixedSize = size;

  // Add the class methods to the queue. Some of these have
  // to override the native Array methods in order to make
  // sure the queue lenght is maintained.
  queue.push = FixedQueue.push;
  queue.splice = FixedQueue.splice;
  queue.unshift = FixedQueue.unshift;

  // Trim any initial excess from the queue.
  FixedQueue.trimTail.call( queue );

  // Return the new queue.
  return( queue );

}


// I trim the queue down to the appropriate size, removing
// items from the beginning of the internal array.
FixedQueue.trimHead = function(){

  // Check to see if any trimming needs to be performed.
  if (this.length <= this.fixedSize){

    // No trimming, return out.
    return;

  }

  // Trim whatever is beyond the fixed size.
  Array.prototype.splice.call(
    this,
    0,
    (this.length - this.fixedSize)
  );

};


// I trim the queue down to the appropriate size, removing
// items from the end of the internal array.
FixedQueue.trimTail = function(){

  // Check to see if any trimming needs to be performed.
  if (this.length <= this.fixedSize){

    // No trimming, return out.
    return;

  }

  // Trim whatever is beyond the fixed size.
  Array.prototype.splice.call(
    this,
    this.fixedSize,
    (this.length - this.fixedSize)
  );

};


// I synthesize wrapper methods that call the native Array
// methods followed by a trimming method.
FixedQueue.wrapMethod = function( methodName, trimMethod ){

  // Create a wrapper that calls the given method.
  var wrapper = function(){

    // Get the native Array method.
    var method = Array.prototype[ methodName ];

    // Call the native method first.
    var result = method.apply( this, arguments );

    // Trim the queue now that it's been augmented.
    trimMethod.call( this );

    // Return the original value.
    return( result );

  };

  // Return the wrapper method.
  return( wrapper );

};


// Wrap the native methods.
FixedQueue.push = FixedQueue.wrapMethod(
  "push",
  FixedQueue.trimHead
);

FixedQueue.splice = FixedQueue.wrapMethod(
  "splice",
  FixedQueue.trimTail
);

FixedQueue.unshift = FixedQueue.wrapMethod(
  "unshift",
  FixedQueue.trimTail
);
