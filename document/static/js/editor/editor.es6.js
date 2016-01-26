/* Functions for ProseMirror integration.*/

import {ProseMirror} from "prosemirror/dist/edit/main"
import {fromDOM} from "prosemirror/dist/format"
import {serializeTo} from "prosemirror/dist/format"
import {Step} from "prosemirror/dist/transform"
import "prosemirror/dist/collab"
//import "prosemirror/dist/menu/menubar"

import {fidusSchema} from "./es6_modules/schema"
import {UpdateUI} from "./es6_modules/update-ui"
import {CommentStore} from "./es6_modules/comment"

var theEditor = {};

function makeEditor (where, doc, version) {
  return new ProseMirror({
    place: where,
    schema: fidusSchema,
    doc: doc,
//    menuBar: true,
    collab: {version: version}
  })
};


theEditor.createDoc = function (aDocument) {
    var editorNode = document.createElement('div'),
      titleNode = aDocument.metadata.title ? exporter.obj2Node(aDocument.metadata.title) : document.createElement('div'),
      documentContentsNode = exporter.obj2Node(aDocument.contents),
      metadataSubtitleNode = aDocument.metadata.subtitle ? exporter.obj2Node(aDocument.metadata.subtitle) : document.createElement('div'),
      metadataAuthorsNode = aDocument.metadata.authors ? exporter.obj2Node(aDocument.metadata.authors) : document.createElement('div'),
      metadataAbstractNode = aDocument.metadata.abstract ? exporter.obj2Node(aDocument.metadata.abstract) : document.createElement('div'),
      metadataKeywordsNode = aDocument.metadata.keywords ? exporter.obj2Node(aDocument.metadata.keywords) : document.createElement('div'),
      doc;

      titleNode.id = 'document-title'
      metadataSubtitleNode.id = 'metadata-subtitle'
      metadataAuthorsNode.id = 'metadata-authors'
      metadataAbstractNode.id = 'metadata-abstract'
      metadataKeywordsNode.id = 'metadata-keywords'
      documentContentsNode.id = 'document-contents'

      editorNode.appendChild(titleNode);
      editorNode.appendChild(metadataSubtitleNode);
      editorNode.appendChild(metadataAuthorsNode);
      editorNode.appendChild(metadataAbstractNode);
      editorNode.appendChild(metadataKeywordsNode);
      editorNode.appendChild(documentContentsNode);

      doc = fromDOM(fidusSchema, editorNode)
      return doc
}

theEditor.initiate = function () {
      let doc = theEditor.createDoc(theDocument)
      theEditor.editor = makeEditor(document.getElementById('document-editable'), doc, theDocument.version)
      while (theDocumentValues.last_diffs.length > 0) {
          let diff = theDocumentValues.last_diffs.shift()
          theEditor.applyDiff(diff)
      }
      new UpdateUI(theEditor.editor, "selectionChange change activeMarkChange blur focus")
      theEditor.editor.on("change", editorHelpers.documentHasChanged)
      theEditor.editor.on('transform', theEditor.onTransform)
      theEditor.editor.on("flushed", mathHelpers.layoutEmptyEquationNodes)
      theEditor.editor.on("flushed", mathHelpers.layoutEmptyDisplayEquationNodes)
      theEditor.editor.on("flushed", citationHelpers.formatCitationsInDocIfNew)
      theDocument.hash = theEditor.getHash()
      theEditor.editor.mod.collab.on("mustSend", theEditor.sendToCollaborators)
      theEditor.comments = new CommentStore(theEditor.editor, theDocument.comment_version)
      theEditor.comments.on("mustSend", theEditor.sendToCollaborators)
      _.each(theDocument.comments, function (comment){
        theEditor.comments.addLocalComment(comment.id, comment.user,
          comment.userName, comment.userAvatar, comment.date, comment.comment, comment.answers)
      })
      jQuery.event.trigger({
          type: "documentDataLoaded",
      })
}

theEditor.update = function () {
      let doc = theEditor.createDoc(theDocument)
      theEditor.editor.setOption("collab", null)
      theEditor.editor.setContent(doc)
      theEditor.editor.setOption("collab", {version: theDocument.version})
      while (theDocumentValues.last_diffs.length > 0) {
          let diff = theDocumentValues.last_diffs.shift()
          theEditor.applyDiff(diff)
      }
      theDocument.hash = theEditor.getHash()
      theEditor.editor.mod.collab.on("mustSend", theEditor.sendToCollaborators)
}


theEditor.getUpdates = function (callback) {
      var outputNode = nodeConverter.viewToModelNode(serializeTo(theEditor.editor.mod.collab.versionDoc,'dom'));
      theDocument.title = theEditor.editor.doc.firstChild.textContent;
      theDocument.version = theEditor.editor.mod.collab.version;
      theDocument.metadata.title = exporter.node2Obj(outputNode.getElementById('document-title'));
      theDocument.metadata.subtitle = exporter.node2Obj(outputNode.getElementById('metadata-subtitle'));
      theDocument.metadata.authors = exporter.node2Obj(outputNode.getElementById('metadata-authors'));
      theDocument.metadata.abstract = exporter.node2Obj(outputNode.getElementById('metadata-abstract'));
      theDocument.metadata.keywords = exporter.node2Obj(outputNode.getElementById('metadata-keywords'));
      theDocument.contents = exporter.node2Obj(outputNode.getElementById('document-contents'));
      theDocument.hash = theEditor.getHash();
      theDocument.comments = theEditor.comments.comments;
      if (callback) {
          callback();
      }
};

theEditor.unconfirmedSteps = {};

var confirmStepsRequestCounter = 0;

theEditor.sendToCollaborators = function () {
      console.log('send to collabs')
      let toSend = theEditor.editor.mod.collab.sendableSteps()
      let request_id = confirmStepsRequestCounter++
      let aPackage = {
          type: 'diff',
          diff_version: theEditor.editor.mod.collab.version,
          diff: toSend.steps.map(s => s.toJSON()),
          comments: theEditor.comments.unsentEvents(),
          comment_version: theEditor.comments.version,
          request_id: request_id
      }
      serverCommunications.send(aPackage)
      theEditor.unconfirmedSteps[request_id] = {
          diffs: toSend,
          comments: theEditor.comments.hasUnsentEvents()
      }

};

theEditor.confirmDiff = function (request_id) {
    console.log('confirming steps')
    let sentSteps = theEditor.unconfirmedSteps[request_id]["diffs"]
    theEditor.editor.mod.collab.confirmSteps(sentSteps)

    let sentComments = theEditor.unconfirmedSteps[request_id]["comments"]
    theEditor.comments.eventsSent(sentComments)
};

theEditor.applyDiff = function(diff) {
    theEditor.editor.mod.collab.receive([diff].map(j => Step.fromJSON(fidusSchema, j)));
}

theEditor.updateComments = function(comments, comment_version) {
    theEditor.comments.receive(comments, comment_version)
}


theEditor.startCollaborativeMode = function () {
    theDocumentValues.collaborativeMode = true;
};

theEditor.stopCollaborativeMode = function () {
    theDocumentValues.collaborativeMode = false;
};

theEditor.getHash = function () {
    let string = JSON.stringify(theEditor.editor.mod.collab.versionDoc)
    let len = string.length
    var hash = 0, char, i;
    if (len == 0) return hash;
    for (i = 0; i < len; i++) {
        char = string.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash;
    }
    return hash;
};
theEditor.checkHash = function(version, hash) {
    console.log('Verifying hash')
    if (version===theEditor.editor.mod.collab.version) {
      if(hash===theEditor.getHash()) {
          console.log('Hash could be verified')
          return
      }
      console.log('Hash could not be verified, requesting document.')
      serverCommunications.send({type: 'get_document'})
      return
    } else {
      serverCommunications.send({
        type: 'check_version',
        version: theEditor.editor.mod.collab.version
      });
      return
    }
}


// Things to be executed on every editor transform.
theEditor.onTransform = function(transform) {
  var updateBibliography = false
  // Check what area is affected
  transform.steps.forEach(function(step, index){
      if (step.type==='replace' && step.from.cmp(step.to) !== 0) {
          transform.docs[index].inlineNodesBetween(step.from, step.to, function(node) {
              if (node.type.name==='citation') {
                  // A citation was replaced
                  updateBibliography = true
              }
          })
      }
  })

  if (updateBibliography) {
    theEditor.editor.on('flushed', citationHelpers.formatCitationsInDoc)
  }


}

window.theEditor = theEditor;
